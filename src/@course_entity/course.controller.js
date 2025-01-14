const { StatusCodes } = require("http-status-codes");

const courseModel = require("./course.model.js");
const { NotFoundError } = require("../../errors/index.js");

// Add a course
exports.addCourse = async (req, res) => {
  const { plan, title, modules } = req.body;

  if (!title) {
    throw new BadRequestError("Please enter course title");
  }
  const course = await courseModel.create({ plan, title, modules });

  if (!course) {
    throw new BadRequestError("Course not created");
  }

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: "Course created Successfully",
  });
};

// Get all courses
exports.getCourses = async (req, res) => {
  const courses = await courseModel.find();
  res.status(StatusCodes.OK).json({
    success: true,
    data: { courses },
  });
};

// Get a single course
exports.getCourse = async (req, res) => {
  const course = await courseModel.findById(req.params.id);
  if (!course) {
    throw new NotFoundError("Course not found");
  }
  res.status(StatusCodes.OK).json({
    success: true,
    data: { course },
  });
};

// Update a course
exports.updateCourse = async (req, res) => {
  const course = await courseModel.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!course) {
    throw new NotFoundError("Course not found");
  }
  res.status(StatusCodes.OK).json({
    success: true,
    data: { course },
  });
};
