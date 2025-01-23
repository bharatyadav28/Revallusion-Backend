const { StatusCodes } = require("http-status-codes");

const courseModel = require("./course.model.js");
const { NotFoundError, BadRequestError } = require("../../errors/index.js");
const { StringToObjectId } = require("../../utils/helperFuns.js");
const VideoModel = require("../@video_entity/video.model.js");

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

// Add new module in a course
exports.addModule = async (req, res) => {
  const { courseId, name } = req.body;

  if (!name) {
    throw new BadRequestError("Please enter module name");
  }

  const course = await courseModel.findOne({
    _id: courseId,
  });
  if (!course) throw new NotFoundError("Target course doesn't exist");

  course.modules.push({ name });
  await course.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Module added successfully",
    data: course,
  });
};

// Add a submodule
exports.addSubModule = async (req, res) => {
  const { courseId, moduleId, name, thumbnailUrl } = req.body;

  if (!name) throw new BadRequestError("Please enter submodule name");

  const course = await courseModel.findOne({
    _id: courseId,
  });
  if (!course) throw new NotFoundError("Requested course may not exists");

  const module = course.modules.id(moduleId);
  if (!module) throw new NotFoundError("Requested module may not exists");

  const subModules = module.subModules;

  const latestSequence = courseModel.getLatestSequenceNumber(subModules);

  const newSubModule = { name, sequence: latestSequence + 1, thumbnailUrl };
  module.subModules.push(newSubModule);
  await course.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Submodule added successfully",
  });
};

// Update a submodule present in a module
exports.updateSubModule = async (req, res) => {
  let { courseId, moduleId, name, thumbnailUrl, newModuleId, sequence } =
    req.body;
  if (!name) throw new BadRequestError("Please enter submodule name");

  const { id: subModuleId } = req.params;

  const course = await courseModel.findOne({
    _id: courseId,
  });
  if (!course) throw new NotFoundError("Requested course may not exists");

  const module = course.modules.id(moduleId);
  if (!module) throw new NotFoundError("Requested module may not exists");

  const subModule = module.subModules.id(subModuleId);
  if (!subModule) throw new NotFoundError("Requested submodule may not exists");

  if (name) subModule.name = name;
  if (thumbnailUrl) subModule.thumbnailUrl = thumbnailUrl;

  const currentSequence = subModule.sequence;

  if (newModuleId) {
    // Case 1: Module changed (Submodule is moved to another module)

    // 1. Add submodule to new module
    const targetModule = course.modules.id(newModuleId);
    if (!targetModule) {
      throw new NotFoundError("The target module doesn't exist");
    }

    // Find greatest sequence number of  submodules in target module
    const targetSubModules = targetModule.subModules;
    const latestSequence =
      courseModel.getLatestSequenceNumber(targetSubModules);

    if (!sequence || sequence <= 0 || sequence > latestSequence) {
      sequence = latestSequence + 1;
    } else {
      // If submodule is inserted at a specific sequence(other than last), increment required submodule sequences
      targetSubModules.forEach((subMod) => {
        if (subMod.sequence >= sequence) {
          subMod.sequence += 1;
        }
      });
    }

    const newSubModule = {
      ...subModule.toObject(),
      sequence,
    };
    targetSubModules.push(newSubModule);

    //2. Remove submodule from previous module
    courseModel.removeItemSequence({
      arr: module.subModules,
      toRemoveItem: subModule,
    });

    // 3. Update submodule id in video model for each video in that module
    const videosUpdatePromises = subModule.videos.map(async (video) => {
      const updatedVideo = VideoModel.findByIdAndUpdate(
        video.videoId,
        {
          module: newModuleId,
        },
        {
          new: true,
          runValidators: true,
        }
      );
      return updatedVideo;
    });

    const results = await Promise.all(videosUpdatePromises);

    // Check for errors in the results
    const errors = results.filter((result) => result && result?.error);

    if (errors.length > 0) {
      throw new BadRequestError(
        "Error in submodule id in video model:",
        errors
      );
    }
  } else if (sequence && sequence !== currentSequence) {
    // Case 2:  Submodule sequence changed

    if (sequence < 0) {
      throw new BadRequestError("Negative sequence number not allowed");
    }

    const latestSequence = courseModel.getLatestSequenceNumber(
      module.subModules
    );

    if (sequence > latestSequence) sequence = latestSequence;

    if (sequence < currentSequence) {
      // If new sequence is less than current sequence, increment required submodule sequences
      module.subModules.forEach((subMod) => {
        if (subMod.sequence >= sequence && subMod.sequence < currentSequence) {
          subMod.sequence += 1;
        }
      });
    } else {
      // If new sequence is greater than current sequence, decrement required submodule sequences
      module.subModules.forEach((subMod) => {
        if (subMod.sequence <= sequence && subMod.sequence > currentSequence) {
          subMod.sequence -= 1;
        }
      });
    }

    // Assign this sequence to this item
    subModule.sequence = sequence;
  }

  await course.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Submodule updated successfully",
    course: course,
    subModule: subModule,
  });
};
