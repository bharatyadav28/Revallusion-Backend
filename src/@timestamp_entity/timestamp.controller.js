const TimestampModel = require("./timestamp.model");
const { BadRequestError } = require("../../errors");
const { StatusCodes } = require("http-status-codes");
const { default: mongoose } = require("mongoose");

exports.addTimeStamp = async (req, res) => {
  const { id: videoId } = req.params;
  const { time, title } = req.body;

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
  const { time, title } = req.body;

  const timestamp = await TimestampModel.findByIdAndUpdate(
    id,
    {
      time,
      title,
    },
    {
      runValidators: true,
      new: true,
    }
  );
  if (!timestamp) {
    throw new BadRequestError("Timestamp updation failed");
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Timestamp added successfully",
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
