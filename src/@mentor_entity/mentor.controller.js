const { StatusCodes } = require("http-status-codes");

const MentorModel = require("./mentor.model.js");
const { NotFoundError } = require("../../errors/index.js");

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
  const mentor = await MentorModel.findOne();
  if (!mentor) {
    throw new NotFoundError("Mentor's data not found");
  }
  res.status(StatusCodes.OK).json({
    success: true,
    data: { mentor },
    message: "Mentor's data fetch successfully",
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
