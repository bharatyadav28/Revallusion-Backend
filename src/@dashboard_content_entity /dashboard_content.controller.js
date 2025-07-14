const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");

const DashboardContentModel = require("./dashboard_content.model");
const { BadRequestError } = require("../../errors/index.js");
const { awsUrl } = require("../../utils/helperFuns");

// Get dashboard content
exports.getDashboardContent = async (req, res) => {
  //   const content = await DashboardContentModel.find();

  const content = await DashboardContentModel.aggregate([
    {
      $lookup: {
        from: "videos",
        localField: "videos.video",
        foreignField: "_id",
        pipeline: [
          // {
          //   $match: {
          //     isDeleted: false,
          //   },
          // },
          {
            $lookup: {
              from: "courses",
              let: {
                courseId: "$course",
              },
              pipeline: [
                {
                  $match: { $expr: { $eq: ["$_id", "$$courseId"] } },
                },

                {
                  $project: {
                    level: 1,
                    _id: 0,
                  },
                },
              ],
              as: "course",
            },
          },

          {
            $addFields: {
              level: {
                $ifNull: [{ $arrayElemAt: ["$course.level", 0] }, -1],
              },
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
              title: 1,
              description: 1,
              duration: 1,
              thumbnailUrl: 1,
              level: 1,
            },
          },
        ],
        as: "videos",
      },
    },
  ]);
  res.status(StatusCodes.OK).json({
    success: true,
    data: { content },
  });
};

// Add section name
exports.addSectionName = async (req, res) => {
  const { name } = req.body;

  const section = await DashboardContentModel.create({ name });

  if (!section) {
    throw new BadRequestError("Section not created");
  }

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: "Section created successfully",
  });
};

// Update section
exports.updateSection = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  const result = await DashboardContentModel.updateOne(
    { _id: id },
    { name },
    { runValidators: true }
  );

  if (result.matchedCount === 0) {
    throw new BadRequestError("Section not found");
  }

  if (result.modifiedCount === 0) {
    throw new BadRequestError("Section not updated");
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Section updated successfully",
  });
};

// Add Video to section
exports.addVideoToSection = async (req, res) => {
  const { id } = req.params;

  const { videos } = req.body;

  const videoObjectIds = videos
    .map((vid) =>
      mongoose.Types.ObjectId.isValid(vid)
        ? { video: new mongoose.Types.ObjectId(vid) }
        : null
    )
    .filter((vid) => vid !== null);

  const result = await DashboardContentModel.findByIdAndUpdate(
    id,
    { $push: { videos: { $each: videoObjectIds } } },
    { new: true, runValidators: true }
  );

  if (!result) {
    throw new BadRequestError("Section not found");
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Video added successfully",
  });
};

// Remove Video from section
exports.removeVideoFromSection = async (req, res) => {
  const { id } = req.params;
  const { videoId } = req.body;

  const result = await DashboardContentModel.updateOne(
    { _id: id },
    { $pull: { videos: { video: videoId } } },
    { runValidators: true }
  );

  if (result.matchedCount === 0) {
    throw new BadRequestError("Section not found");
  }

  if (result.modifiedCount === 0) {
    throw new BadRequestError("Video removal failes");
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Video removed successfully",
  });
};

// Delete section
exports.deleteSection = async (req, res) => {
  const { id } = req.params;

  const result = await DashboardContentModel.findByIdAndDelete(id);

  if (!result) {
    throw new BadRequestError("Section not found");
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Section deleted successfully",
  });
};
