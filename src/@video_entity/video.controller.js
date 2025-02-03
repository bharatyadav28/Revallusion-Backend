const mongoose = require("mongoose");
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
} = require("../../utils/helperFuns.js");
const CourseModel = require("../@course_entity/course.model.js");

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
        videoUrl: {
          $concat: [awsUrl, "/", "$videoUrl"],
        },
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

// Fetch a single video
exports.getVideo = async (req, res, next) => {
  const videoId = req.params.id;
  if (!videoId) {
    throw new BadRequestError("Please enter video id");
  }

  const video = await VideoModel.findOne({ _id: videoId, isDeleted: false });
  if (!video) {
    throw new BadRequestError("Video not found");
  }
  video.thumbnailUrl = appendBucketName(video.thumbnailUrl);
  video.videoUrl = appendBucketName(video.videoUrl);

  res.status(StatusCodes.OK).json({
    success: true,
    data: { video },
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
  } = req.body;

  if (!title || !description || !thumbnailUrl || !videoUrl) {
    throw new BadRequestError("Please enter all required fields");
  }

  // Extract keys from url
  if (videoUrl) videoUrl = extractURLKey(videoUrl);
  if (thumbnailUrl) thumbnailUrl = extractURLKey(thumbnailUrl);

  const videoData = {
    title,
    description,
    thumbnailUrl,
    videoUrl,
    course: course || null,
    module: course && module ? module : null,
    submodule: course && module ? submodule : null,
    duration,
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
  let { title, description, thumbnailUrl, course, module, submodule } =
    req.body;

  if (thumbnailUrl) thumbnailUrl = extractURLKey(thumbnailUrl);

  // Video course, module or submodule is updated (paid)
  const isVideoLocationUpdated =
    !video?.course?.equals(StringToObjectId(course)) ||
    video.module !== (module || null) ||
    video.submodule !== (submodule || null);

  if (title) video.title = title;
  if (description) video.description = description;
  if (thumbnailUrl) video.thumbnailUrl = thumbnailUrl;

  if (isVideoLocationUpdated) {
    // Remove video from source course if exists

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

        const targetCourse = await CourseModel.findOne({
          _id: course,
        }).select("isFree");

        if (!targetCourse) {
          course = null;
        }

        const isTargetCourseFree = targetCourse?.isFree || false;

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

  const video = await VideoModel.findOne({ _id: videoId, isDeleted: false });
  if (!video) {
    throw new BadRequestError("Video not found");
  }

  if (video.course) {
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
        video.course = null;
        video.submodule = null;
        video.module = null;
        video.sequence = -1;
        video.isDeleted = true;
        video.deletedAt = Date.now();

        await video.save({ session });
      });

      await session.endSession();
    } catch (error) {
      await session.endSession();
      throw error;
    }
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
    throw new BadRequestError("Video status is already " + isActive);
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
  const { search } = req.query;

  let query = { isDeleted: false };
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  const videos = await VideoModel.find(query).select("title description");

  return res.status(StatusCodes.OK).json({
    success: true,
    data: { videos },
    message: "Videos fetch successfully",
  });
};
