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

const getSubModuleVideos = ({ modules, module, subModule }) => {
  // Find existing module
  const existingModule = modules.find((m) =>
    m._id.equals(StringToObjectId(module))
  );
  if (!existingModule) throw new BadRequestError("Module not found");

  // Find existing submodule
  const existingSubModule = existingModule?.subModules.find((s) =>
    s._id.equals(StringToObjectId(subModule))
  );
  if (!existingSubModule) throw new BadRequestError("Submodule not found");

  return existingSubModule?.videos;
};

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

  const coursesQuery = courseModel.find().select("title modules");

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
    subModule,
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
    module,
    subModule,
    duration,
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

  if (existingCourse && !isFreeCourse) {
    if (!module) throw new BadRequestError("Please enter module id");
    if (!subModule) throw new BadRequestError("Please enter submodule id");

    videoData.module = module;
    videoData.subModule = subModule;
  }

  // Save video
  const video = await VideoModel.create(videoData);

  if (!video) {
    throw new BadRequestError("Video not saved");
  }

  // Video doesnot belong to any course
  if (!existingCourse) {
    return res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Video saved successfully",
    });
  }

  //  Add video id to corrsponsding course
  if (!isFreeCourse) {
    // Find existing module

    const existingVideos = getSubModuleVideos({
      modules: existingCourse.modules,
      module,
      subModule,
    });

    // Check if video already exists
    const videoIndex = existingVideos.findIndex((v) => v.videoId === video._id);
    if (videoIndex !== -1) {
      throw new BadRequestError("Video already exists");
    }

    const latestSequence = courseModel.getLatestSequenceNumber(existingVideos);

    existingVideos.push({ videoId: video._id, sequence: latestSequence + 1 });
    await existingCourse.save();
  } else {
    // Add video id to Intoductory (free videos)
    const freeVideos = existingCourse.freeVideos;

    const latestSequence = courseModel.getLatestSequenceNumber(freeVideos);
    freeVideos.push({ videoId: video._id, sequence: latestSequence + 1 });
    await existingCourse.save();
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
  let { title, description, thumbnailUrl, course, module, subModule } =
    req.body;

  // if (!course) throw new BadRequestError("Please enter course id");
  if (thumbnailUrl) thumbnailUrl = extractURLKey(thumbnailUrl);
  let isIntroductory = false;

  // Video course, module or submodule is updated (paid)
  const isVideoLocationUpdated =
    !video?.course?.equals(StringToObjectId(course)) ||
    video.module !== module ||
    video.subModule !== subModule;

  if (isVideoLocationUpdated) {
    // Remove video from source course if exists
    if (video.course) {
      const sourceCourse = await courseModel.findById(video.course);
      const isSourceCourseFree = sourceCourse.isFree;
      const sourceCourseVideos = !isSourceCourseFree
        ? getSubModuleVideos({
            modules: sourceCourse.modules,
            module: video.module,
            subModule: video.subModule,
          })
        : sourceCourse.freeVideos;

      // Video in sub-module
      const videoEntry = sourceCourseVideos.find((v) =>
        v.videoId.equals(videoId)
      );

      courseModel.removeItemSequence({
        arr: sourceCourseVideos,
        toRemoveItem: videoEntry,
        isVideo: true,
      });
      await sourceCourse.save();
    }

    // Push video id to target course
    if (course) {
      const targetExistingCourse = await courseModel.findOne({
        _id: course,
      });
      const isTargetCourseFree = targetExistingCourse.isFree;
      isIntroductory = isTargetCourseFree;

      const targetCourseVideos = !isTargetCourseFree
        ? getSubModuleVideos({
            modules: targetExistingCourse.modules,
            module,
            subModule,
          })
        : targetExistingCourse.freeVideos;

      const latestSequence =
        courseModel.getLatestSequenceNumber(targetCourseVideos);
      targetCourseVideos.push({
        videoId: video._id,
        sequence: latestSequence + 1,
      });

      await targetExistingCourse.save();
    }
  }

  // Save video(Model)
  if (title) video.title = title;
  if (description) video.description = description;
  if (thumbnailUrl) video.thumbnailUrl = thumbnailUrl;
  video.course = course || null;
  video.module = isIntroductory || !course || !module ? null : module;
  video.subModule = isIntroductory || !course || !subModule ? null : subModule;

  await video.save();

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
    const existingCourse = await courseModel.findById(video.course);
    const isCourseFree = existingCourse.isFree;

    const existingVideos = !isCourseFree
      ? getSubModuleVideos({
          modules: existingCourse.modules,
          module: video.module,
          subModule: video.subModule,
        })
      : existingCourse.freeVideos;

    const videoEntry = existingVideos.find((v) => v.videoId.equals(video._id));
    if (!videoEntry) {
      throw new BadRequestError("Video doesn't exists in submodule");
    }

    courseModel.removeItemSequence({
      arr: existingVideos,
      toRemoveItem: videoEntry,
      isVideo: true,
    });

    await existingCourse.save();
  }

  // Video data (soft delete)
  video.isDeleted = true;
  video.deletedAt = Date.now();
  video.course = null;
  video.module = null;
  video.subModule = null;
  await video.save();

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

  const existingCourse = await courseModel.findById(video.course);
  const existingVideos = getSubModuleVideos({
    modules: existingCourse.modules,
    module: video.module,
    subModule: video.subModule,
  });

  const videoEntry = existingVideos.find((v) => v.videoId.equals(video._id));
  if (!videoEntry) {
    throw new BadRequestError("Video doesn't exists in submodule");
  }

  if (isActive === false) {
    courseModel.removeItemSequence({
      arr: existingVideos,
      toRemoveItem: videoEntry,
      isVideo: true,
      makeInactive: true,
    });
  } else {
    const latestSequence = courseModel.getLatestSequenceNumber(existingVideos);
    videoEntry.sequence = latestSequence + 1;
  }

  await existingCourse.save();

  video.isActive = isActive;
  await video.save();

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
        for (const subModule of module.subModules || []) {
          subModule.videos = []; // Clear videos in subModules
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
