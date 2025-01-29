const { StatusCodes } = require("http-status-codes");

const CarousalModel = require("./carousal.model.js");
const CourseModel = require("../@course_entity/course.model.js");
const { NotFoundError } = require("../../errors/index.js");
const {
  StringToObjectId,
  updateSequence,
} = require("../../utils/helperFuns.js");

// Add a carousal
exports.addCarousalData = async (req, res) => {
  const { videos: newVideos } = req.body;

  if (newVideos.length == 0) {
    throw new BadRequestError("Please enter videos");
  }

  let carousals = await CarousalModel.findOne();
  if (!carousals) {
    carousals = await CarousalModel.create({ videos: [] });

    if (!carousals) {
      throw new BadRequestError("Something went wrong in creating carousals");
    }
  }

  const carousalsVideos = carousals.videos;
  const latestSequence = CourseModel.getLatestSequenceNumber(carousalsVideos);

  for (let i = 0; i < newVideos.length; i++) {
    newVideos[i].sequence = latestSequence + i + 1;
  }

  carousals.videos = [...carousalsVideos, ...newVideos];

  await carousals.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Carousal added successfully",
  });
};

// Get all carousals
exports.getCarousals = async (req, res) => {
  const carousals = await CarousalModel.findOne().populate("videos.videoId");

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Carousals fetched successfully",
    data: { carousals },
  });
};

// Update a carousal
exports.updateCarousal = async (req, res) => {
  const { id: videoId } = req.params;
  let { sequence } = req.body;

  const carousals = await CarousalModel.findOne();
  if (!carousals) {
    throw new BadRequestError("No carosual array exists");
  }

  const carousalsVideos = carousals.videos;

  const existingVideo = carousalsVideos.find((v) =>
    v.videoId.equals(StringToObjectId(videoId))
  );
  if (!existingVideo) {
    throw new BadRequestError("Video doesn't exists in the tutorial");
  }

  const currentSequence = existingVideo.sequence;
  const latestSequence = CourseModel.getLatestSequenceNumber(carousalsVideos);

  sequence = updateSequence({
    arr: carousalsVideos,
    currentSequence,
    latestSequence,
    newSequence: sequence,
  });

  existingVideo.sequence = sequence;

  await carousals.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Carousal sequence updated successfully",
  });
};

// Delete a carousal
exports.deleteCarousal = async (req, res) => {
  const { id: videoId } = req.params;

  const carousals = await CarousalModel.findOne();
  if (!carousals) {
    throw new BadRequestError("No carosual array exists");
  }

  const existingVideos = carousals.videos;
  const videoEntry = existingVideos.find((v) =>
    v.videoId.equals(StringToObjectId(videoId))
  );
  if (!videoEntry) {
    throw new BadRequestError("carousal doesn't exist");
  }

  CourseModel.removeItemSequence({
    arr: existingVideos,
    toRemoveItem: videoEntry,
    isVideo: true,
  });

  await carousals.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Carosual removed successfully",
  });
};
