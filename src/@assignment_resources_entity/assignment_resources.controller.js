const mongoose = require("mongoose");

const { BadRequestError } = require("../../errors");
const { extractURLKey } = require("../../utils/helperFuns");
const VideoModel = require("../@video_entity/video.model");
const AssignmentResourcesModel = require("./assignment_resources.model");

exports.addAssignmentResources = async (req, res) => {
  const videoId = req.params.videoId;
  const { finalCutVideoUrl, assetsUrl, assignment } = req.body;

  if (!finalCutVideoUrl || !assetsUrl || !assignment) {
    throw new BadRequestError(
      "finalCutVideoUrl, assetsUrl and assignment are required"
    );
  }

  // Check if the video exists
  const video = await VideoModel.findById(videoId);
  if (!video) {
    throw new BadRequestError("Video not found");
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const updateResult = await VideoModel.updateOne(
      { _id: videoId },
      {
        $set: {
          assignment: assignment,
        },
      },
      { new: true, runValidators: true, session }
    );

    if (updateResult.matchedCount === 0) {
      throw new BadRequestError("Video not found for update");
    }
    if (updateResult.modifiedCount === 0) {
      throw new BadRequestError("Video update failed - no changes made");
    }

    let assignmentResources = await AssignmentResourcesModel.findOne({
      video: videoId,
    });

    if (assignmentResources) {
      // Update existing document
      assignmentResources.finalCutVideoUrl = finalCutVideoUrl;
      assignmentResources.assetsUrl = assetsUrl;
      await assignmentResources.save({ session });
    } else {
      // Create new document
      assignmentResources = await AssignmentResourcesModel.create(
        [
          {
            video: videoId,
            finalCutVideoUrl: finalCutVideoUrl,
            assetsUrl: assetsUrl,
          },
        ],
        { session }
      );
    }

    if (!assignmentResources) {
      throw new BadRequestError("Failed to create assignment resources");
    }

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }

  return res.status(200).json({
    success: true,
    message: "Assignment resources added successfully",
  });
};

exports.getAssignmentResourcesByVideoId = async (req, res) => {
  const videoId = req.params.videoId;

  const assignmentResources = await AssignmentResourcesModel.findOne({
    video: videoId,
  });

  //   if (!assignmentResources) {
  //     throw new BadRequestError("Assignment resources not found");
  //   }

  return res.status(200).json({
    success: true,
    data: { assignmentResources },
  });
};
