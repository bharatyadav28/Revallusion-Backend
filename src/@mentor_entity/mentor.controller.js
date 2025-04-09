const { StatusCodes } = require("http-status-codes");

const MentorModel = require("./mentor.model.js");
const { NotFoundError } = require("../../errors/index.js");
const { appendBucketName } = require("../../utils/helperFuns.js");
const { BadRequestError } = require("../../errors/index.js");
const { s3AdminUploadv4 } = require("../../utils/s3");

// Add or update mentor's data
exports.addMentor = async (req, res) => {
  const { name, designation, about, networks } = req.body;

  const mentor = await MentorModel.findOne();

  if (mentor) {
    if (name) mentor.name = name;
    if (designation) mentor.designation = designation;
    if (about) mentor.about = about;
    if (networks) mentor.networks = networks;
    await mentor.save();
  } else {
    await MentorModel.create({ name, designation, about, networks });
  }

  const statusCode = mentor ? StatusCodes.OK : StatusCodes.CREATED;
  const message = mentor
    ? "Mentor details updated successfully"
    : "Mentor created created successfully";

  res.status(statusCode).json({
    success: true,
    message: message,
  });
};

// Get mentor's data
exports.getMentorsData = async (req, res, next) => {
  const mentor = await MentorModel.findOne().select("-curriculum");
  if (!mentor) {
    throw new NotFoundError("Mentor's data not found");
  }
  res.status(StatusCodes.OK).json({
    success: true,
    data: { mentor },
    message: "Mentor's data fetch successfully",
  });
};

// Update curriculum link
exports.updateCurriculum = async (req, res, next) => {
  if (!req.file) {
    throw new BadRequestError("Please upload an file");
  }

  const mentor = await MentorModel.findOne();
  if (!mentor) {
    throw new NotFoundError("Mentor's data  should be added first");
  }

  const curriculumPath = (await s3AdminUploadv4(req.file, "Curriculum")).Key;

  mentor.curriculum = curriculumPath;
  await mentor.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Curriculum updated successfully",
  });
};

// Get curriculum link
exports.getCurriculum = async (req, res, next) => {
  const mentor = await MentorModel.findOne().select("curriculum");
  if (!mentor) {
    throw new NotFoundError("Mentor's data  should be added first");
  }

  const curriculumPath = mentor.curriculum;

  let curriculum = "";

  if (curriculumPath) {
    curriculum = appendBucketName(mentor.curriculum);
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Curriculum updated successfully",
    data: {
      curriculum: curriculum,
    },
  });
};

// Delete mentor's data
exports.deleteMentorsData = async (req, res, next) => {
  const mentor = await MentorModel.deleteMany();
  if (!mentor) {
    throw new NotFoundError("Mentor's data not found");
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Mentor's data deleted successfully",
  });
};
