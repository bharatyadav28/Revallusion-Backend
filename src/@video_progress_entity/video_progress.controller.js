const { StatusCodes } = require("http-status-codes");

const VideoProgressModel = require("./video_progress.model");
const VideoModel = require("../@video_entity/video.model");

const BadRequestError = require("../../errors/bad-request");
const { NotFoundError } = require("../../errors");
const { default: mongoose } = require("mongoose");

// Update video progress
exports.updateVideoProgress = async (req, res, next) => {
  const { vid: videoId } = req.params;
  const { watchTime } = req.body; // in seconds
  const userId = req.user._id;

  if (!watchTime) {
    throw new BadRequestError("Please enter watched time");
  }

  const existingVideoPromise = VideoModel.findById(videoId)
    .select("course duration")
    .lean();

  let videoProgressPromise = VideoProgressModel.findOne({
    user: req.user._id,
    video: videoId,
  });

  let [existingVideo, videoProgress] = await Promise.all([
    existingVideoPromise,
    videoProgressPromise,
  ]);

  if (!existingVideo) {
    throw new NotFoundError("Targeted video may not exists");
  }
  if (!existingVideo.course) {
    throw new BadRequestError("Targeted video may not belongs to any course");
  }

  const totalDurationMix = existingVideo.duration;
  const totalDurationSeconds =
    (totalDurationMix?.hours || 0) * 3600 +
    (totalDurationMix?.minutes || 0) * 60 +
    (totalDurationMix?.seconds || 0);

  let watchedDuration = Math.min(Math.floor(watchTime), totalDurationSeconds);

  if (!videoProgress) {
    // No progress exists
    videoProgress = new VideoProgressModel({
      user: userId,
      video: videoId,
      watchedDuration,
      lastPosition: watchedDuration,
      totalDuration: totalDurationSeconds,
    });
  } else {
    // Update the previous progress
    videoProgress.lastPosition = watchedDuration;
    videoProgress.watchedDuration = Math.max(
      videoProgress.watchedDuration,
      watchedDuration
    );
  }

  await videoProgress.save();

  const filteredVideoProgress = {
    video: videoProgress.video,
    lastPosition: videoProgress.lastPosition,
    percentageWatched: videoProgress.percentageWatched,
    isCompleted: videoProgress.isCompleted,
  };

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Video progress updated successfully",
    videoProgress: filteredVideoProgress,
  });
};

// Get video progress
exports.getVideoProgress = async (req, res) => {
  const { vid: videoId } = req.params;
  const userId = req.user._id;

  const videoProgress = await VideoProgressModel.findOne(
    {
      user: userId,
      video: videoId,
    },
    {
      _id: 0,
      lastPosition: 1,
      percentageWatched: 1,
      isCompleted: 1,
      video: 1,
    }
  ).lean();

  if (!videoProgress) {
    throw new NotFoundError("Video progress not found");
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Video progress fetched successfully",
    data: { videoProgress },
  });
};

// Get Course  progress
exports.getCourseProgress = async (req, res) => {
  const userId = req.user._id;
  const { cid: courseId } = req.params;

  const courseProgress = await VideoProgressModel.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
      },
    },

    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        pipeline: [
          {
            $match: {
              course: new mongoose.Types.ObjectId(courseId),
            },
          },
        ],
        as: "videoDetails",
      },
    },
    {
      $unwind: "$videoDetails",
    },
    {
      $project: {
        _id: 0,
        video: 1,
        lastPosition: 1,
        percentageWatched: 1,
        isCompleted: 1,
      },
    },
  ]);

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Course progress fetched successfully",
    data: { courseProgress },
  });
};
