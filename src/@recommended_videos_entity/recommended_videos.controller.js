const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");

const RecommendedVideosModel = require("./recommended_videos.model");
const { NotFoundError } = require("../../errors");

exports.getCourseRecommendations = async (req, res) => {
  const courseId = req.params.courseId;

  const videos = await RecommendedVideosModel.aggregate([
    {
      $match: {
        course: new mongoose.Types.ObjectId(courseId),
      },
    },
    {
      $sort: { sequence: 1 },
    },
    {
      $lookup: {
        from: "videos",
        let: {
          videoId: "$video",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$_id", "$$videoId"],
              },
            },
          },
          {
            $project: {
              title: 1,
              description: 1,
            },
          },
        ],
        as: "Videos",
      },
    },
    {
      $set: {
        video: { $arrayElemAt: ["$Videos", 0] },
      },
    },
    {
      $project: {
        video: 1,
        sequence: 1,
        isActive: 1,
      },
    },
  ]);

  return res.status(200).json({
    success: true,
    message: "Recommended course videos fetched successfully",
    data: { videos },
  });
};

exports.addRecommendedVideos = async (req, res) => {
  const { videos: newVideos } = req.body;
  const courseId = req.params.courseId;

  if (newVideos.length === 0) {
    throw new BadRequestError("Please select atleast one video");
  }

  const nextSequence =
    Number(await RecommendedVideosModel.getNextSequence(courseId)) - 1;

  const newRecommendedVideos = newVideos.map((video, index) => ({
    sequence: nextSequence + index + 1,
    video: video,
    course: courseId,
  }));

  const videos = await RecommendedVideosModel.insertMany(newRecommendedVideos);

  res.status(StatusCodes.OK).json({
    success: true,
    message: " Recommended videos added successfully",
  });
};

exports.updateRecommendedVideoSequence = async (req, res) => {
  const { id } = req.params;
  let { sequence } = req.body;
  sequence = Number(sequence);

  const recommendedVideo = await RecommendedVideosModel.findById(id);
  if (!recommendedVideo) {
    throw new NotFoundError("Recommended video not found");
  }

  if (sequence !== recommendedVideo.sequence) {
    // Validate sequence number
    if (sequence < 1) sequence = 1;

    // Sequence  number must not exceeds limit
    const newSequenceLimit = await RecommendedVideosModel.getNextSequence(
      recommendedVideo.course
    );

    if (sequence >= newSequenceLimit) sequence = newSequenceLimit - 1;

    // Start a session
    const session = await mongoose.startSession();

    try {
      // Perform multiple operation, one fail then roll back

      await session.withTransaction(async () => {
        const oldSequence = recommendedVideo.sequence;

        // 1. Temporarily mark the moving submodule
        await RecommendedVideosModel.updateOne(
          { _id: new mongoose.Types.ObjectId(recommendedVideo._id) },
          { $set: { sequence: -1 } },
          { session }
        );

        if (sequence > oldSequence) {
          // 2. Moving down: decrease sequence of items in between
          await RecommendedVideosModel.updateMany(
            {
              sequence: { $gt: oldSequence, $lte: sequence },
              course: recommendedVideo.course,
            },
            { $inc: { sequence: -1 } },
            { session }
          );
        } else if (sequence < oldSequence) {
          //3.  Moving up: increase sequence of items in between
          const r = await RecommendedVideosModel.updateMany(
            {
              sequence: { $gte: sequence, $lt: oldSequence },
              course: recommendedVideo.course,
            },
            { $inc: { sequence: 1 } },
            { session }
          );
        }

        // Update the submodule's sequence
        recommendedVideo.sequence = sequence;
        await recommendedVideo.save({ session });
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

exports.deleteRecommendedVideo = async (req, res) => {
  const { id } = req.params;

  const recommendedVideo = await RecommendedVideosModel.findById(id);
  if (!recommendedVideo) {
    throw new NotFoundError("Recommended video not found");
  }

  const sequence = recommendedVideo.sequence;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const deletedRecommendedVideo =
        await RecommendedVideosModel.findByIdAndDelete(id, { session });

      if (!deletedRecommendedVideo) {
        throw new NotFoundError("Recommended video not found");
      }

      // Update sequence numbers of remaining videos
      await RecommendedVideosModel.updateMany(
        {
          sequence: { $gt: sequence },
          course: recommendedVideo.course,
        },
        {
          $inc: { sequence: -1 },
        },
        { session }
      );
    });
  } catch (error) {
    throw error;
  } finally {
    await session.endSession();
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Recommended video removed successfully",
  });
};

exports.updateActiveStatus = async (req, res, next) => {
  const docId = req.params.id;
  const { isActive } = req.body;

  const doc = await RecommendedVideosModel.findOne({ _id: docId });
  if (!doc) {
    throw new NotFoundError("Video not found");
  }
  if (doc.isActive === isActive) {
    throw new BadRequestError(
      `Video status is already  ${isActive ? "active" : "inactive"}`
    );
  }

  if (isActive === false) {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // Update sequences in old location
        const query = {};

        await RecommendedVideosModel.updateMany(
          {
            ...query,
            sequence: { $gt: doc.sequence },
          },
          { $inc: { sequence: -1 } },
          { session }
        );

        // Update video with new location and sequence

        doc.sequence = -1;
        doc.isActive = false;

        await doc.save({ session });
      });

      await session.endSession();
    } catch (error) {
      await session.endSession();
      throw error;
    }
  } else {
    const newSequence = await RecommendedVideosModel.getNextSequence(
      doc.course
    );
    doc.sequence = newSequence;
    doc.isActive = true;
    await doc.save();
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Video status updated successfully",
  });
};
