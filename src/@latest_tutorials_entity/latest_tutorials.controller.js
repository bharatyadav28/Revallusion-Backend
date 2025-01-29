const LatestTutorailsModel = require("./latest_tutorials.model.js");
const CourseModel = require("../@course_entity/course.model.js");
const { BadRequestError } = require("../../errors/index.js");
const { StatusCodes } = require("http-status-codes");
const {
  updateSequence,
  StringToObjectId,
} = require("../../utils/helperFuns.js");

// Get all latest tutorials
exports.getAllLatestTutorials = async (req, res) => {
  const tutorials = await LatestTutorailsModel.findOne().populate(
    "videos.videoId"
  );

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Tutorials fetched successfully",
    data: { tutorials },
  });
};

// Add videos to tutorial
exports.addVideosToTutorials = async (req, res) => {
  const { videos: newVideos } = req.body;

  // Video array is empty
  if (newVideos.length == 0) {
    throw new BadRequestError("Please enter videos");
  }

  let tutorial = await LatestTutorailsModel.findOne();
  if (!tutorial) {
    tutorial = await LatestTutorailsModel.create({ videos: [] });

    if (!tutorial) {
      throw new BadRequestError("Somehting went wrong in creating tutorials");
    }
  }

  const tutorialVideos = tutorial.videos;
  const latestSequence = CourseModel.getLatestSequenceNumber(tutorialVideos);

  for (let i = 0; i < newVideos.length; i++) {
    newVideos[i].sequence = latestSequence + i + 1;
  }

  tutorial.videos = [...tutorialVideos, ...newVideos];

  await tutorial.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Videos added successfully",
  });
};

// Update video sequence
exports.updateTutorialVideoSequence = async (req, res) => {
  const { id: videoId } = req.params;
  let { sequence } = req.body;

  const tutorial = await LatestTutorailsModel.findOne();
  if (!tutorial) {
    throw new BadRequestError("No tutorial array exists");
  }

  const tutorialVideos = tutorial.videos;
  const existingVideo = tutorialVideos.find((v) =>
    v.videoId.equals(StringToObjectId(videoId))
  );
  if (!existingVideo) {
    throw new BadRequestError("Video doesn't exists in the tutorial");
  }

  const currentSequence = existingVideo.sequence;
  const latestSequence = CourseModel.getLatestSequenceNumber(tutorialVideos);

  sequence = updateSequence({
    arr: tutorialVideos,
    currentSequence,
    latestSequence,
    newSequence: sequence,
  });

  existingVideo.sequence = sequence;

  await tutorial.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Video sequence updated successfully",
  });
};

// Remove video from tutorial
exports.deleteVideosFromTutorials = async (req, res) => {
  const { id: videoId } = req.params;

  const tutorial = await LatestTutorailsModel.findOne();
  if (!tutorial) {
    throw new BadRequestError("No tutorial array exists");
  }

  const existingVideos = tutorial.videos;

  const videoEntry = existingVideos.find((v) =>
    v.videoId.equals(StringToObjectId(videoId))
  );
  if (!videoEntry) {
    throw new BadRequestError("Video doesn't exists in the tutorial");
  }

  CourseModel.removeItemSequence({
    arr: existingVideos,
    toRemoveItem: videoEntry,
    isVideo: true,
  });

  await tutorial.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Videos removed successfully",
  });
};
