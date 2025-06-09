const mongoose = require("mongoose");
const aws = require("aws-sdk");
const crypto = require("crypto");
const { promisify } = require("util");
const mime = require("mime-types");

const { generateUploadURL, s3delete } = require("../../utils/s3.js");
const { BadRequestError, NotFoundError } = require("../../errors/index.js");
const VideoModel = require("./video.model.js");
const courseModel = require("../@course_entity/course.model.js");
const { StatusCodes } = require("http-status-codes");
const {
  extractURLKey,
  appendBucketName,
  awsUrl,
  StringToObjectId,
  generateUniqueId,
  extractVideoURLKey,
} = require("../../utils/helperFuns.js");
const CourseModel = require("../@course_entity/course.model.js");
const OrderModel = require("../@order_entity/order.model.js");
const PlanModel = require("../@plan_entity/plan.model.js");
const {
  getVideoTimeStamps,
} = require("../@timestamp_entity/timestamp.controller.js");

// Get presigned url for upload video
exports.getUploadURL = async (req, res, next) => {
  const { videoExtension } = req.body;

  if (!videoExtension) {
    throw new BadRequestError("Please enter video extension");
  }
  const data = await generateUploadURL(videoExtension);
  if (!data.uploadURL) return next(new ErrorHandler("URL not found", 404));

  res.status(StatusCodes.OK).json({
    success: true,
    data,
  });
};

// Fetch all videos
exports.getVideos = async (req, res, next) => {
  const videosQuery = VideoModel.aggregate([
    {
      // Stage 1, fetch videos
      $match: { isDeleted: false },
    },
    {
      // Stage 2, append aws url
      $addFields: {
        thumbnailUrl: {
          $concat: [awsUrl, "/", "$thumbnailUrl"],
        },
        // videoUrl: {
        //   $concat: [awsUrl, "/", "$videoUrl", "/1080pvideo_00001.ts"],
        // },
      },
    },
  ]);

  const coursesQuery = courseModel.aggregate([
    {
      $lookup: {
        from: "coursemodules",
        localField: "_id",
        foreignField: "course",
        pipeline: [
          // Nested lookup to get submodules for each module
          { $project: { _id: 1, name: 1 } },
          {
            $lookup: {
              from: "submodules",
              localField: "_id",
              foreignField: "module",
              pipeline: [
                // Sort submodules by sequence
                { $sort: { sequence: 1 } },
                // Nested lookup to get videos for each submodule
                { $project: { _id: 1, name: 1 } },
              ],
              as: "submodules",
            },
          },
        ],
        as: "modules",
      },
    },
    // Optional: Lookup for free videos directly associated with course
    {
      $lookup: {
        from: "videos",
        localField: "_id",
        foreignField: "course",
        pipeline: [
          {
            $match: {
              isActive: true,
              isDeleted: false,
              submodule: null, // Only get videos directly linked to course
            },
          },
          { $sort: { sequence: 1 } },
        ],
        as: "freeVideos",
      },
    },
  ]);

  const [videos, courses] = await Promise.all([videosQuery, coursesQuery]);

  res.status(StatusCodes.OK).json({
    success: true,
    data: { videos, courses },
    message: "Videos fetch successfully",
  });
};

// Fetch only free videos
exports.getIntroductoryVideos = async (req, res) => {
  const [freeVideos] = await CourseModel.aggregate([
    {
      // Stage 1
      $match: {
        isFree: true,
      },
    },
    {
      // Stage 2: fetch introductory videos
      $lookup: {
        from: "videos",
        localField: "_id",
        foreignField: "course",
        pipeline: [
          {
            $match: {
              isDeleted: false,
              // isActive: true,
            },
          },
          {
            $sort: {
              sequence: 1,
            },
          },
          {
            $addFields: {
              thumbnailUrl: {
                $concat: [awsUrl, "/", "$thumbnailUrl"],
              },
            },
          },
          {
            $project: {
              _id: 1,
              title: 1,
              description: 1,
              thumbnailUrl: 1,
              duration: 1,
              sequence: 1,
            },
          },
        ],
        as: "introductoryVideos",
      },
    },
    {
      // Stage 3: Select specific field
      $project: {
        introductoryVideos: 1,
      },
    },
  ]);

  const introductoryVideos = freeVideos?.introductoryVideos || [];

  return res.status(StatusCodes.OK).json({
    success: true,
    data: { introductoryVideos },
  });
};

// Fetch a single video
exports.getVideo = async (req, res, next) => {
  const videoId = req.params.id;
  const userRole = req?.user?.role;

  if (!videoId) {
    throw new BadRequestError("Please enter video id");
  }

  // Fetch video
  const videoPromise = VideoModel.findOne(
    {
      _id: videoId,
      //  isDeleted: false
    },
    {
      title: 1,
      description: 1,
      thumbnailUrl: 1,
      videoUrl: 1,
      assignment: 1,
      course: 1,
      submodule: 1,
    }
  )
    .populate({
      path: "course",
      model: "Course",
      select: "_id isFree plan",
    })
    .populate({
      path: "submodule",
      model: "Submodule",
      select: "resource",
    })
    .lean();

  const timestampsPromise = getVideoTimeStamps(videoId);

  // Fetch user subscription
  const orderPromise = OrderModel.findOne({
    status: "Active",
    user: req.user._id,
  })
    .populate({ path: "plan", select: "_id level" })
    .lean();

  const [video, timestamps, order] = await Promise.all([
    videoPromise,
    timestampsPromise,
    orderPromise,
  ]);

  if (!video) {
    throw new BadRequestError("Requested video may not exists");
  }

  if (userRole !== "staff" && !video?.course?.isFree) {
    // Subscription check i.e video is not free

    if (!order) {
      throw new BadRequestError("Please purchase a plan to access this video");
    }

    // Advance subscription has access to videos of all plans
    if (
      !order.plan._id.equals(video?.course?.plan) &&
      order.plan.level !== Number(process.env.ADVANCE_PLAN)
    ) {
      throw new BadRequestError(
        "Please upgrade your plan to access this video"
      );
    }
  }

  // Append bucket name
  video.thumbnailUrl = appendBucketName(video.thumbnailUrl);
  // video.videoUrl = (video.videoUrl);
  if (video.assignment) video.assignment = appendBucketName(video.assignment);
  if (video?.submodule?.resource) {
    video.resource = appendBucketName(video.submodule.resource);
  }

  // Exclude unnecessary fields
  const { course, submodule, ...filteredVideo } = video;

  res.status(StatusCodes.OK).json({
    success: true,
    data: { video: filteredVideo, timestamps },
    message: "Video fetch successfully",
  });
};

// Save video with meta data in db
exports.saveVideo = async (req, res, next) => {
  let {
    title,
    description,
    thumbnailUrl,
    videoUrl,
    course,
    module,
    submodule,
    duration,
    assignment,
  } = req.body;

  if (!title || !description || !thumbnailUrl || !videoUrl) {
    throw new BadRequestError("Please enter all required fields");
  }

  // videoUrl = decodeURIComponent(videoUrl);
  // console.log("Video Url", videoUrl);

  // // Extract keys from url
  // if (videoUrl) videoUrl = extractVideoURLKey(videoUrl);
  if (thumbnailUrl) thumbnailUrl = extractURLKey(thumbnailUrl);
  if (assignment) assignment = extractURLKey(assignment);

  const videoData = {
    title,
    description,
    thumbnailUrl,
    videoUrl,
    course: course || null,
    module: course && module ? module : null,
    submodule: course && module ? submodule : null,
    duration,
    assignment,
    sequence: 0,
  };

  let isFreeCourse = false;
  let existingCourse = null;

  // Find existing course
  if (course) {
    existingCourse = await courseModel.findById(course);
    if (course && !existingCourse) {
      throw new BadRequestError("Course not found");
    }
    isFreeCourse = existingCourse.isFree;
  }

  if (existingCourse) {
    if (!isFreeCourse) {
      if (!module) throw new BadRequestError("Please enter module id");
      if (!submodule) throw new BadRequestError("Please enter submodule id");

      videoData.module = module;
      videoData.submodule = submodule;
    }

    const sequence = await VideoModel.getNextSequence({
      course,
      submodule,
    });

    videoData.sequence = sequence;
  }

  // Save video
  const video = await VideoModel.create(videoData);

  if (!video) {
    throw new BadRequestError("Video not saved");
  }

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: "Video saved successfully",
  });
};

// Update video data
exports.updateVideo = async (req, res, next) => {
  const videoId = req.params.id;
  if (!videoId) {
    throw new BadRequestError("Please enter video id");
  }

  // Find video
  const video = await VideoModel.findOne({ _id: videoId, isDeleted: false });
  if (!video) {
    throw new BadRequestError("Video not found");
  }

  // New Incoming data
  let {
    title,
    description,
    thumbnailUrl,
    course,
    module,
    submodule,
    resource,
    assignment,
  } = req.body;

  if (thumbnailUrl) thumbnailUrl = extractURLKey(thumbnailUrl);
  if (resource) resource = extractURLKey(resource);
  if (assignment) assignment = extractURLKey(assignment);

  // Video course, module or submodule is updated (paid)
  const isVideoLocationUpdated =
    !video?.course?.equals(StringToObjectId(course)) ||
    !video?.module?.equals(StringToObjectId(module)) ||
    !video?.submodule?.equals(StringToObjectId(submodule));

  if (title) video.title = title;
  if (description) video.description = description;
  if (thumbnailUrl) video.thumbnailUrl = thumbnailUrl;
  if (resource) video.resource = resource;
  if (assignment) video.assignment = assignment;

  if (isVideoLocationUpdated) {
    // Remove video from source course if exists
    let targetCourse = null;
    let isTargetCourseFree = false;

    if (course) {
      targetCourse = await CourseModel.findOne({
        _id: course,
      }).select("isFree");

      if (!targetCourse) {
        course = null;
      }

      isTargetCourseFree = targetCourse?.isFree || false;

      if (targetCourse && !isTargetCourseFree) {
        if (!module) throw new BadRequestError("Please select tool");
        if (!submodule) throw new BadRequestError("Please select topic");
      }
    }

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        if (video.course) {
          // Update sequences in old location
          const oldQuery = {};
          if (video.submodule) {
            oldQuery.submodule = video.submodule;
          } else if (video.course) {
            oldQuery.course = video.course;
            oldQuery.submodule = null;
          }

          await mongoose.model("Video").updateMany(
            {
              ...oldQuery,
              sequence: { $gt: video.sequence },
            },
            { $inc: { sequence: -1 } },
            { session }
          );
        }

        // Get new sequence for target location
        const newSequence = await VideoModel.getNextSequence({
          course,
          submodule: !isTargetCourseFree ? submodule : null,
        });

        // Update video with new location and sequence
        video.course = course || null;
        video.module = !course
          ? null
          : isTargetCourseFree
          ? null
          : module || null;
        video.submodule = !course
          ? null
          : isTargetCourseFree
          ? null
          : submodule || null;

        video.sequence = !course ? 0 : newSequence;

        await video.save({ session });
      });

      await session.endSession();
    } catch (error) {
      await session.endSession();
      throw error;
    }
  } else {
    await video.save();
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Video updated successfully",
  });
};

// Delete video (soft delete)
exports.deleteVideo = async (req, res, next) => {
  const videoId = req.params.id;
  if (!videoId) {
    throw new BadRequestError("Please enter video id");
  }

  const video = await VideoModel.findOne({
    _id: videoId,
    isDeleted: false,
  });
  if (!video) {
    throw new BadRequestError("Video not found");
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // Update sequences in old location

      let updateSequencePromise = null;

      if (video.course) {
        const query = {};
        if (video.submodule) {
          query.submodule = video.submodule;
        } else {
          query.course = video.course;
          query.submodule = null;
        }

        updateSequencePromise = VideoModel.updateMany(
          {
            ...query,
            sequence: { $gt: video.sequence },
          },
          { $inc: { sequence: -1 } },
          { session }
        );
      }

      const softDeleteVideoPromise = VideoModel.updateOne(
        { _id: videoId },
        {
          $set: {
            isDeleted: true,
            deletedAt: Date.now(),
            course: null,
            submodule: null,
            module: null,
            sequence: 0,
          },
        },
        { session }
      );

      const allPromises = [softDeleteVideoPromise];
      if (updateSequencePromise) {
        allPromises.push(updateSequencePromise);
      }
      await Promise.all(allPromises);
    });

    await session.endSession();
  } catch (error) {
    await session.endSession();
    throw error;
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Video deleted successfully",
  });
};

// Change active status of video
exports.updateActiveStatus = async (req, res, next) => {
  const videoId = req.params.id;
  const { isActive } = req.body;

  const video = await VideoModel.findOne({ _id: videoId, isDeleted: false });
  if (!video) {
    throw new NotFoundError("Video not found");
  }
  if (video.isActive === isActive) {
    throw new BadRequestError(
      `Video status is already  ${isActive ? "active" : "inactive"}`
    );
  }

  if (isActive === false) {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // Update sequences in old location
        const query = {};
        if (video.submodule) {
          query.submodule = video.submodule;
        } else if (video.course) {
          query.course = video.course;
          query.submodule = null;
        }

        await VideoModel.updateMany(
          {
            ...query,
            sequence: { $gt: video.sequence },
          },
          { $inc: { sequence: -1 } },
          { session }
        );

        // Update video with new location and sequence

        video.sequence = -1;
        video.isActive = false;

        await video.save({ session });
      });

      await session.endSession();
    } catch (error) {
      await session.endSession();
      throw error;
    }
  } else {
    const newSequence = await VideoModel.getNextSequence({
      course: video.course,
      submodule: video.submodule,
    });
    video.sequence = newSequence;
    video.isActive = true;
    await video.save();
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Video status updated successfully",
  });
};

// Permanently delete video (Hard delete)
exports.permanatelyDeleteVideo = async (req, res, next) => {
  const videoId = req.params.id;
  if (!videoId) {
    throw new BadRequestError("Please enter video id");
  }

  const video = await VideoModel.findOne({ _id: videoId, isDeleted: true });
  if (!video) {
    throw new BadRequestError("Video not found");
  }

  await s3delete(video.videoUrl);
  await s3delete(video.thumbnailUrl);
  await VideoModel.deleteOne({ _id: videoId });

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Video permanently deleted successfully",
  });
};

// Permanently delete all videos
exports.deleteAllVideos = async (req, res, next) => {
  try {
    // Delete all videos
    await VideoModel.deleteMany({});

    const videos = await VideoModel.find({});
    for (let video of videos) {
      await s3delete(video.videoUrl);
      await s3delete(video.thumbnailUrl);
      await VideoModel.deleteOne({ _id: video._id });
    }

    // Fetch all courses as Mongoose documents
    const existingCourses = await courseModel.find({}); // Ensure no .lean() is used

    for (const course of existingCourses) {
      for (const module of course.modules || []) {
        for (const submodule of module.submodules || []) {
          submodule.videos = []; // Clear videos in submodules
        }
      }
      course.freeVideos = []; // Clear freeVideos for the course
      await course.save(); // Save each updated course
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "All videos deleted successfully",
    });
  } catch (error) {
    next(error); // Pass error to error-handling middleware
  }
};

// Get video list with specific fields
exports.getVideoList = async (req, res, next) => {
  const { search, resultPerPage, currentPage } = req.query;

  const { excludeVideos } = req.body;

  let query = {
    isDeleted: false,
    $or: [{ module: { $exists: false } }, { module: null }],
  };

  if (excludeVideos) {
    query._id = { $nin: excludeVideos };
  }

  if (search) {
    query.$and = [
      {
        $or: [{ module: { $exists: false } }, { module: null }],
      }, // Preserve module filter
      {
        $or: [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ],
      }, // Add search filter
    ];
    delete query.$or; // Remove top-level $or to avoid conflict
  }

  const limit = Number(resultPerPage) || 8;
  const page = Number(currentPage) || 1;
  const skip = (page - 1) * limit;

  const videosPromise = await VideoModel.find(query)
    .skip(skip)
    .limit(limit)
    .select("title description");

  const videosCountPromise = await VideoModel.countDocuments(query);

  const [videos, videosCount] = await Promise.all([
    videosPromise,
    videosCountPromise,
  ]);

  const pagesCount = Math.ceil(videosCount / limit) || 1;

  return res.status(StatusCodes.OK).json({
    success: true,
    data: { videos, pagesCount },
    message: "Videos fetch successfully",
  });
};

// Start video upload of largerize

const randomBytes = promisify(crypto.randomBytes);
const s3 = new aws.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_BUCKET_REGION,
  signatureVersion: "v4",
});

exports.initiateMultipartUpload = async (req, res) => {
  const { videoExtension } = req.body;

  const fileExtension = videoExtension;

  const rawBytes = await randomBytes(16);
  // const videoName = rawBytes.toString("hex");

  const uuid = generateUniqueId();
  let key = `admin-uploads/${uuid}.${fileExtension}`;

  const params = {
    Bucket: process.env.AWS_VIDEO_BUCKET_NAME,
    Key: key,
    // ContentType: `video/${fileExtension}`,
    ContentType: mime.lookup(fileExtension) || "application/octet-stream",
  };

  const multipartUpload = await s3.createMultipartUpload(params).promise();
  return res.status(StatusCodes.OK).json({
    success: true,
    data: {
      uploadId: multipartUpload.UploadId,
      key,
    },
  });
};

exports.getUploadParts = async (req, res) => {
  const data = req.body;
  const { uploadId, key, partCount } = data;

  if (!uploadId || !key || !partCount) {
    throw new BadRequestError("Missing required parameters");
  }

  const urls = [];

  for (let i = 1; i <= partCount; i++) {
    const params = {
      Bucket: process.env.AWS_VIDEO_BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      PartNumber: i,
      Expires: 3600,
    };

    const uploadURL = await s3.getSignedUrlPromise("uploadPart", params);
    urls.push({
      partNumber: i,
      url: uploadURL,
    });
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    data: {
      urls,
    },
  });
};

exports.completeMultipartUpload = async (req, res) => {
  const { uploadId, key, parts } = req.body;

  if (!uploadId || !key || !parts || !parts.length) {
    return res
      .status(400)
      .json({ success: false, error: "Missing required parameters" });
  }

  // Format parts array as expected by S3
  const formattedParts = parts.map((part) => ({
    ETag: part.ETag,
    PartNumber: part.PartNumber,
  }));

  const params = {
    Bucket: process.env.AWS_VIDEO_BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: formattedParts,
    },
  };

  const result = await s3.completeMultipartUpload(params).promise();

  return res.status(StatusCodes.OK).json({
    success: true,
    data: {
      result,
    },
  });
};

exports.abortMultipartUpload = async (req, res) => {
  const { uploadId, key } = req.body;

  if (!uploadId || !key) {
    return res
      .status(400)
      .json({ success: false, error: "Missing required parameters" });
  }

  const params = {
    Bucket: process.env.AWS_VIDEO_BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
  };

  await s3.abortMultipartUpload(params).promise();

  res.status(200).json({
    success: true,
    message: "Upload aborted successfully",
  });
};

exports.searchVideos = async (req, res) => {
  const user = req.user._id;
  const search = req.query.search;

  const plansPromise = PlanModel.find().select("_id level");
  const orderPromise = OrderModel.findOne({
    user,
    status: "Active",
    expiry_date: { $gte: Date.now() },
  })
    .populate({ path: "plan", select: "_id level" })
    .select("_id")
    .lean();

  const [plans, order] = await Promise.all([plansPromise, orderPromise]);
  if (!order) {
    throw new BadRequestError("No active plans");
  }

  const includedPlans = [order.plan._id];
  if (order.plan.level === Number(process.env.ADVANCE_PLAN)) {
    const beginnerPlan = plans.find(
      (plan) => plan.level === Number(process.env.BEGINNER_PLAN)
    );
    includedPlans.push(beginnerPlan._id);
  }

  let videoQuery = {};

  if (search) {
    const videoRegex = new RegExp(search, "i");
    videoQuery.$or = [
      { title: { $regex: videoRegex } },
      { description: { $regex: videoRegex } },
    ];
  }

  const filteredVideos = await CourseModel.aggregate([
    {
      $match: {
        $or: [
          {
            plan: {
              $in: includedPlans,
            },
          },
          { isFree: true },
        ],
      },
    },
    {
      $lookup: {
        from: "videos",
        let: {
          courseId: "$_id",
          planId: "$plan",
        },
        pipeline: [
          {
            $match: {
              $and: [
                {
                  $expr: { $eq: ["$course", "$$courseId"] },
                },
                videoQuery,
              ],
            },
          },
          {
            $set: {
              plan: "$$planId",
            },
          },
          {
            $project: {
              title: 1,
              description: 1,
              duration: 1,
              plan: 1,
              thumbnailUrl: {
                $concat: [awsUrl, "/", "$thumbnailUrl"],
              },
            },
          },
        ],
        as: "videos",
      },
    },
    { $unwind: "$videos" },
    { $replaceRoot: { newRoot: "$videos" } },
  ]);

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Video fetched successfully",
    data: {
      filteredVideos,
    },
  });
};
