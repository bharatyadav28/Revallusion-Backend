const TimestampModel = require("./timestamp.model");
const VideoModel = require("../@video_entity/video.model");
const { BadRequestError } = require("../../errors");
const { StatusCodes } = require("http-status-codes");
const { default: mongoose } = require("mongoose");

exports.addTimeStamp = async (req, res) => {
  const { id: videoId } = req.params;
  const { time, title } = req.body;

  await verifyTimeStamp({ videoId, time });

  const timestamp = await TimestampModel.create({
    video: videoId,
    time,
    title,
  });
  if (!timestamp) {
    throw new BadRequestError("Timestamp creation failed");
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Timestamp added successfully",
    data: {
      timestamp,
    },
  });
};

exports.updateTimeStamp = async (req, res) => {
  const { id } = req.params;
  let { time, title } = req.body;
  time = Number(time);

  const timestamp = await TimestampModel.findById(id);
  if (!timestamp) {
    throw new BadRequestError("Timestamp updation failed");
  }

  if (timestamp.time !== time) {
    await verifyTimeStamp({ videoId: timestamp.video, time });
    timestamp.time = time;
  }
  timestamp.title = title;
  await timestamp.save();

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Timestamp updated successfully",
    data: {
      timestamp,
    },
  });
};

// Helper fun
exports.getVideoTimeStamps = async (videoId) => {
  const timestamps = await TimestampModel.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $sort: {
        time: 1,
      },
    },
    {
      $project: {
        time: 1,
        title: 1,
      },
    },
  ]);

  return timestamps;
};

exports.getTimeStamps = async (req, res) => {
  const { id: videoId } = req.params;
  const timestamps = await exports.getVideoTimeStamps(videoId);
  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Video timestamps fetched successfully",
    data: {
      timestamps,
    },
  });
};

exports.deleteTimestamp = async (req, res) => {
  const { id } = req.params;

  const timestamp = await TimestampModel.findByIdAndDelete(id);
  if (!timestamp) {
    throw new BadRequestError("Timestamp deletion failed");
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Timestamp deleted successfully",
  });
};

const verifyTimeStamp = async ({ videoId, time }) => {
  const video = await VideoModel.findById(videoId).lean();
  if (!video) {
    throw new BadRequestError("Error in accessing video");
  }
  const { hours, minutes, seconds } = video.duration;
  let durationInSec = hours * 3600 + minutes * 60 + seconds;
  if (time >= durationInSec) {
    throw new BadRequestError(
      "Start time cannot be greater than complete video duration"
    );
  }
};
