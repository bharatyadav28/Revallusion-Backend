const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");

const CarousalModel = require("./carousal.model.js");
const CourseModel = require("../@course_entity/course.model.js");
const { NotFoundError } = require("../../errors/index.js");
const {
  StringToObjectId,
  updateSequence,
  awsUrl,
} = require("../../utils/helperFuns.js");

// Add a carousal
exports.addCarousalData = async (req, res) => {
  const { videos: newVideos } = req.body;

  if (newVideos.length === 0) {
    throw new BadRequestError("Please enter videos");
  }

  const nextSequence = Number(await CarousalModel.getNextSequence()) - 1;

  const newCarousals = newVideos.map((video, index) => ({
    sequence: nextSequence + index + 1,
    video: video.videoId,
  }));

  await CarousalModel.insertMany(newCarousals);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Carousal added successfully",
  });
};

// Get all carousals
exports.getCarousals = async (req, res) => {
  const carousals = await CarousalModel.aggregate([
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
                $concat: [awsUrl + "/" + "$thumbnailUrl"],
              },
              videoUrl: {
                $concat: [awsUrl + "/" + "$videoUrl"],
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
    message: "Carousals fetched successfully",
    data: { carousals },
  });
};

// Update a carousal
exports.updateCarousal = async (req, res) => {
  const { id } = req.params;
  let { sequence } = req.body;

  const carousal = await CarousalModel.findById(id);
  if (!carousal) {
    throw new NotFoundError("Carousal not found");
  }

  if (sequence !== carousal.sequence) {
    // Validate sequence number
    if (sequence < 1) sequence = 1;

    // Sequence  number must not exceeds limit
    const newSequenceLimit = await CarousalModel.getNextSequence();

    if (sequence >= newSequenceLimit) sequence = newSequenceLimit - 1;

    // Start a session
    const session = await mongoose.startSession();

    try {
      // Perform multiple operation, one fail then roll back

      await session.withTransaction(async () => {
        const oldSequence = carousal.sequence;

        // 1. Temporarily mark the moving submodule
        await CarousalModel.updateOne(
          { _id: carousal._id },
          { $set: { sequence: -1 } }, // Temporary marker
          { session }
        );

        if (sequence > oldSequence) {
          // 2. Moving down: decrease sequence of items in between
          await CarousalModel.updateMany(
            {
              sequence: { $gt: oldSequence, $lte: sequence },
            },
            { $inc: { sequence: -1 } },
            { session }
          );
        } else if (sequence < oldSequence) {
          //3.  Moving up: increase sequence of items in between
          const r = await CarousalModel.updateMany(
            {
              sequence: { $gte: sequence, $lt: oldSequence },
            },
            { $inc: { sequence: 1 } },
            { session }
          );
        }

        // Update the submodule's sequence
        carousal.sequence = sequence;
        await carousal.save({ session });
      });

      await session.endSession();
    } catch (error) {
      await session.endSession();
      throw error;
    }
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Carousal sequence updated successfully",
  });
};

// Delete a carousal
exports.deleteCarousal = async (req, res) => {
  const { id } = req.params;

  const carousal = await CarousalModel.findById(id);
  if (!carousal) {
    throw new NotFoundError("Carousal not found");
  }

  const sequence = carousal.sequence;

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const deletedCarousal = await CarousalModel.findByIdAndDelete(id, {
        session,
      });

      if (!deletedCarousal) {
        throw new Error("Carousal not found or already deleted");
      }

      await CarousalModel.updateMany(
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
    message: "Carosual removed successfully",
  });
};
