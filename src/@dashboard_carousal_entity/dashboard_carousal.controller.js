const { StatusCodes } = require("http-status-codes");

const DashboardCarousalModel = require("./dashboard_carousal.model");
const { extractURLKey, awsUrl } = require("../../utils/helperFuns");
const { BadRequestError, NotFoundError } = require("../../errors");
const { default: mongoose } = require("mongoose");

// Create carousal
exports.createDashboardCarousal = async (req, res) => {
  const { imageUrl } = req.body;

  const imagePath = extractURLKey(imageUrl);
  const nextSequence = Number(await DashboardCarousalModel.getNextSequence());

  const newDashboardCarousal = await DashboardCarousalModel.create({
    sequence: nextSequence,
    image: imagePath,
  });

  if (!newDashboardCarousal) {
    throw new BadRequestError("Dashboard Carousal not created");
  }

  res.status(201).json({
    success: true,
    message: "Image added successfully",
  });
};

// Get all carousals
exports.getDashboardCarousals = async (req, res) => {
  const carousal = await DashboardCarousalModel.aggregate([
    {
      $sort: { sequence: 1 },
    },
    {
      $addFields: {
        image: {
          $concat: [awsUrl, "/", "$image"],
        },
      },
    },
    {
      $project: {
        image: 1,
        sequence: 1,
        createdAt: 1,
      },
    },
  ]);

  res.status(201).json({
    success: true,
    message: "Dashboard fetched successfully",
    data: {
      carousal,
    },
  });
};

exports.updateDashboardCarousal = async (req, res) => {
  const { id } = req.params;
  let { sequence } = req.body;

  const carousal = await DashboardCarousalModel.findById(id);
  if (!carousal) {
    throw new NotFoundError("Dashboard Carousal not found");
  }

  if (sequence !== carousal.sequence) {
    // Validate sequence number
    if (sequence < 1) sequence = 1;

    // Sequence  number must not exceeds limit
    const newSequenceLimit = await DashboardCarousalModel.getNextSequence();

    if (sequence >= newSequenceLimit) sequence = newSequenceLimit - 1;

    // Start a session
    const session = await mongoose.startSession();

    try {
      // Perform multiple operation, one fail then roll back

      await session.withTransaction(async () => {
        const oldSequence = carousal.sequence;

        if (sequence > oldSequence) {
          // 1. Moving down: decrease sequence of items in between
          await DashboardCarousalModel.updateMany(
            {
              sequence: { $gt: oldSequence, $lte: sequence },
            },
            { $inc: { sequence: -1 } },
            { session }
          );
        } else if (sequence < oldSequence) {
          //2.  Moving up: increase sequence of items in between
          const r = await DashboardCarousalModel.updateMany(
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

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Dashboard Carousal updated successfully",
  });
};

// Delete carousal
exports.deleteDashboardCarousal = async (req, res) => {
  const { id } = req.params;

  const carousal = await DashboardCarousalModel.findById(id);

  if (!carousal) {
    throw new NotFoundError("Dashboard Carousal not found");
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const deletedCarousal = await DashboardCarousalModel.findByIdAndDelete(
        id,
        {
          session,
        }
      );

      if (!deletedCarousal) {
        throw new Error("Carousal not found or already deleted");
      }

      await DashboardCarousalModel.updateMany(
        { sequence: { $gt: carousal.sequence } },
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
    message: " Image removed successfully",
  });
};
