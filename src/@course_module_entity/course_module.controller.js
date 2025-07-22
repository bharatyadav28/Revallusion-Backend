const { StatusCodes } = require("http-status-codes");

const CourseModel = require("../@course_entity/course.model.js");
const CourseModuleModel = require("./course_module.model.js");
const VideoModel = require("../@video_entity/video.model.js");
const { NotFoundError, BadRequestError } = require("../../errors/index.js");
const { extractURLKey } = require("../../utils/helperFuns.js");
const { default: mongoose } = require("mongoose");
const SubmoduleModel = require("../@submodule_entity/submodule.model.js");

// Add new module in a course
exports.addModule = async (req, res) => {
  const { courseId, name, thumbnailUrl } = req.body;

  if (!name) {
    throw new BadRequestError("Please enter tool name");
  }

  const course = await CourseModel.findOne({
    _id: courseId,
  });
  if (!course) throw new NotFoundError("Target course doesn't exist");

  const thumbnailPath = extractURLKey(thumbnailUrl);

  const courseModule = await CourseModuleModel.create({
    name,
    course: courseId,
    thumbnailUrl: thumbnailPath,
  });

  if (!courseModule) {
    throw new BadRequestError("Module not created");
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Tool added successfully",
    data: course,
  });
};

// Update module name
exports.updateModuleName = async (req, res) => {
  const { name, courseId, thumbnailUrl } = req.body;
  const { id: moduleId } = req.params;

  const module = await CourseModuleModel.findOne({
    _id: moduleId,
    course: courseId,
  });
  if (!module) throw new NotFoundError("Requested module may not exists");

  module.name = name;

  if (thumbnailUrl) {
    const thumbnailPath = extractURLKey(thumbnailUrl);

    module.thumbnailUrl = thumbnailPath;
  }

  await module.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Tool name updated successfully",
  });
};

exports.deleteModule = async (req, res) => {
  const id = req.params.id;
  const submodules = await SubmoduleModel.aggregate([
    {
      $match: {
        module: new mongoose.Types.ObjectId(id),
      },
    },
    {
      $project: {
        _id: 1,
        module: 1,
        sequence: 1,
      },
    },
  ]);

  for (const submodule of submodules) {
    const module = submodule.module;
    const submoduleId = submodule._id;
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        await VideoModel.updateMany(
          {
            submodule: submoduleId,
          },
          {
            $set: { course: null, module: null, submodule: null },
          },
          {
            session,
            // runValidators: true,
          }
        );

        // Decrement sequence of all submodules having greater sequence than submodule being deleted
        await SubmoduleModel.updateMany(
          {
            module,
            sequence: { $gt: submodule.sequence },
          },
          {
            $inc: { sequence: -1 },
          },
          {
            // runValidators: true,
            session,
          }
        );

        await SubmoduleModel.deleteOne({
          _id: submoduleId,
        });
      });

      await session.endSession();
    } catch (error) {
      await session.endSession();
      throw error;
    }
  }
  await CourseModuleModel.deleteOne({
    _id: id,
  });

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Tool deleted successfully",
  });
};
