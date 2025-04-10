const mongoose = require("mongoose");

const LatestTutorailsModel = require("./latest_tutorials.model.js");
const { BadRequestError } = require("../../errors/index.js");
const { StatusCodes } = require("http-status-codes");
const {
  updateSequence,
  StringToObjectId,
} = require("../../utils/helperFuns.js");
const { awsUrl } = require("../../utils/helperFuns.js");

// Get all latest tutorials
exports.getAllLatestTutorials = async (req, res) => {
  // const tutorials = await LatestTutorailsModel.find()
  //   .populate({ path: "video", select: "title description" })
  //   .lean();

  const tutorials = await LatestTutorailsModel.aggregate([
    { $sort: { sequence: 1 } },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "video",
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
              videoUrl: {
                $concat: [awsUrl, "/", "$videoUrl"],
              },
            },
          },

          {
            $project: {
              title: 1,
              description: 1,
              thumbnailUrl: 1,
              videoUrl: 1,
            },
          },
        ],
      },
    },
    {
      // Stage 3: Filter out documents where video array is empty
      $match: {
        video: { $ne: [] },
      },
    },
    {
      $unwind: "$video",
    },
  ]);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Tutorials fetched successfully",
    data: { tutorials },
  });
};

// Add videos to tutorial
exports.addVideosToTutorials = async (req, res) => {
  const { videos: newVideos } = req.body;

  if (newVideos.length === 0) {
    throw new BadRequestError("Please enter videos");
  }

  const nextSequence = Number(await LatestTutorailsModel.getNextSequence()) - 1;

  const newTutorials = newVideos.map((video, index) => ({
    sequence: nextSequence + index + 1,
    video: video.videoId,
  }));

  await LatestTutorailsModel.insertMany(newTutorials);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Latest tutorial videos added successfully",
  });
};

// Update video sequence
exports.updateTutorialVideoSequence = async (req, res) => {
  const { id } = req.params;
  let { sequence } = req.body;

  const tutorial = await LatestTutorailsModel.findById(id);
  if (!tutorial) {
    throw new NotFoundError("Tutorial not found");
  }

  if (sequence !== tutorial.sequence) {
    // Validate sequence number
    if (sequence < 1) sequence = 1;

    // Sequence  number must not exceeds limit
    const newSequenceLimit = await LatestTutorailsModel.getNextSequence();

    if (sequence >= newSequenceLimit) sequence = newSequenceLimit - 1;

    // Start a session
    const session = await mongoose.startSession();

    try {
      // Perform multiple operation, one fail then roll back

      await session.withTransaction(async () => {
        const oldSequence = tutorial.sequence;

        // 1. Temporarily mark the moving submodule
        await LatestTutorailsModel.updateOne(
          { _id: tutorial._id },
          { $set: { sequence: -1 } }, // Temporary marker
          { session }
        );

        if (sequence > oldSequence) {
          // 2. Moving down: decrease sequence of items in between
          await LatestTutorailsModel.updateMany(
            {
              sequence: { $gt: oldSequence, $lte: sequence },
            },
            { $inc: { sequence: -1 } },
            { session }
          );
        } else if (sequence < oldSequence) {
          //3.  Moving up: increase sequence of items in between
          const r = await LatestTutorailsModel.updateMany(
            {
              sequence: { $gte: sequence, $lt: oldSequence },
            },
            { $inc: { sequence: 1 } },
            { session }
          );
        }

        // Update the submodule's sequence
        tutorial.sequence = sequence;
        await tutorial.save({ session });
      });

      await session.endSession();
    } catch (error) {
      await session.endSession();
      throw error;
    }
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Video sequence updated successfully",
  });
};

// Remove video from tutorial
exports.deleteVideosFromTutorials = async (req, res) => {
  const { id } = req.params;

  const tutorial = await LatestTutorailsModel.findById(id);
  if (!tutorial) {
    throw new NotFoundError("Tutorial not found");
  }

  const sequence = tutorial.sequence;

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const deletedTutorial = await LatestTutorailsModel.findByIdAndDelete(id, {
        session,
      });

      if (!deletedTutorial) {
        throw new Error("Tutorial not found or already deleted");
      }

      await LatestTutorailsModel.updateMany(
        { sequence: { $gt: sequence } },
        { $inc: { sequence: -1 } },
        { session }
      );
    });
  } catch (error) {
    await session.endSession();
    throw error;
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Videos removed successfully",
  });
};
