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
          {
            $match: {
              isDeleted: false,
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
  const { name, videos } = req.body;

  const result = await DashboardContentModel.updateOne(
    { _id: id },
    { name, videos },
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
