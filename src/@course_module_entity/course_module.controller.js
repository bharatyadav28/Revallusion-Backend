const { StatusCodes } = require("http-status-codes");

const CourseModel = require("../@course_entity/course.model.js");
const CourseModuleModel = require("./course_module.model.js");
const { NotFoundError, BadRequestError } = require("../../errors/index.js");

// Add new module in a course
exports.addModule = async (req, res) => {
  const { courseId, name } = req.body;

  if (!name) {
    throw new BadRequestError("Please enter module name");
  }

  const course = await CourseModel.findOne({
    _id: courseId,
  });
  if (!course) throw new NotFoundError("Target course doesn't exist");

  const courseModule = await CourseModuleModel.create({
    name,
    course: courseId,
  });

  if (!courseModule) {
    throw new BadRequestError("Module not created");
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Module added successfully",
    data: course,
  });
};

// Update module name
exports.updateModuleName = async (req, res) => {
  const { name, courseId } = req.body;
  const { id: moduleId } = req.params;

  const module = await CourseModuleModel.findOne({
    _id: moduleId,
    course: courseId,
  });
  if (!module) throw new NotFoundError("Requested module may not exists");

  module.name = name;
  await module.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Module name updated successfully",
  });
};
