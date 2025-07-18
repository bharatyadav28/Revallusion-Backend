const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");

const CourseModuleModel = require("../@course_module_entity/course_module.model.js");
const SubmoduleModel = require("./submodule.model.js");
const { NotFoundError, BadRequestError } = require("../../errors/index.js");
const {
  extractURLKey,
  StringToObjectId,
  awsUrl,
} = require("../../utils/helperFuns.js");
const { s3UploadMulti, s3delete } = require("../../utils/s3.js");
const VideoModel = require("../@video_entity/video.model.js");

// Add a new submodule inside module
exports.addSubModule = async (req, res) => {
  const { moduleId, name, thumbnailUrl } = req.body;
  let { resource } = req.body;

  if (!name) throw new BadRequestError("Please enter topic name");

  const module = await CourseModuleModel.findOne({
    _id: moduleId,
  });
  if (!module) throw new NotFoundError("Requested tool may not exists");

  // Get sequence number for new submodue
  const sequence = await SubmoduleModel.getNextSequence(moduleId);

  const thumbnailPath = extractURLKey(thumbnailUrl);
  resource = extractURLKey(resource);

  // Add the submodule
  const submodule = await SubmoduleModel.create({
    module: moduleId,
    name,
    sequence,
    thumbnailUrl: thumbnailPath,
    resource,
  });

  if (!submodule) {
    throw new BadRequestError("Failed to add topic");
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Topic added successfully",
  });
};

// Update a submodule present in a module
exports.updateSubModule = async (req, res) => {
  let { name, thumbnailUrl, newModuleId, sequence, resource } = req.body;
  if (!name) throw new BadRequestError("Please enter topic name");

  const { id: submoduleId } = req.params;

  // const module = course.modules.id(moduleId);
  // if (!module) throw new NotFoundError("Requested module may not exists");

  const submodule = await SubmoduleModel.findById(submoduleId);
  if (!submodule) throw new NotFoundError("Requested topic may not exists");

  if (name) submodule.name = name;
  if (thumbnailUrl) {
    const thumbnailPath = extractURLKey(thumbnailUrl);

    submodule.thumbnailUrl = thumbnailPath;
  }
  if (resource) {
    resource = extractURLKey(resource);
    submodule.resource = resource;
  }

  const currentSequence = submodule.sequence;

  // Validate sequence number
  if (sequence < 1) sequence = 1;

  // Sequence  number must not exceeds limit
  const newSequenceLimit = await SubmoduleModel.getNextSequence(
    submodule.module
  );
  if (sequence >= newSequenceLimit) sequence = newSequenceLimit - 1;

  if (newModuleId) {
    // Case 1: Submodule is moved to another module

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const oldModuleId = submodule.module;
        const oldSequence = submodule.sequence;

        // 1. Remove module from previous module

        // Decrease sequences in old module
        await mongoose.model("Submodule").updateMany(
          {
            module: oldModuleId,
            sequence: { $gt: oldSequence },
          },
          { $inc: { sequence: -1 } },
          { session }
        );

        // 2. Add submodule to new module

        // Get new sequence for target module
        const newSequence = await SubmoduleModel.getNextSequence(newModuleId);

        // Update submodule with new module and sequence
        submodule.module = newModuleId;
        submodule.sequence = newSequence;
        await submodule.save({ session });

        // update module id in corresponding video ;
        await mongoose.model("Video").updateMany(
          {
            module: oldModuleId,
            submodule: submodule._id,
          },
          { $set: { module: newModuleId } },
          { session }
        );
      });

      await session.endSession();
    } catch (error) {
      await session.endSession();
      throw error;
    }
  } else if (sequence && sequence !== currentSequence) {
    // Case 2: Submodule is moved in the same module

    // Start a session
    const session = await mongoose.startSession();

    try {
      // Perform multiple operation, one fail then roll back

      await session.withTransaction(async () => {
        const oldSequence = submodule.sequence;

        // 1. Temporarily mark the moving submodule
        await mongoose.model("Submodule").updateOne(
          { _id: submodule._id },
          { $set: { sequence: -1 } }, // Temporary marker
          { session }
        );

        if (sequence > oldSequence) {
          // 2. Moving down: decrease sequence of items in between
          await SubmoduleModel.updateMany(
            {
              module: submodule.module,
              sequence: { $gt: oldSequence, $lte: sequence },
            },
            { $inc: { sequence: -1 } },
            { session }
          );
        } else if (sequence < oldSequence) {
          //3.  Moving up: increase sequence of items in between
          await SubmoduleModel.updateMany(
            {
              module: submodule.module,
              sequence: { $gte: sequence, $lt: oldSequence },
            },
            { $inc: { sequence: 1 } },
            { session }
          );
        }

        // Update the submodule's sequence
        submodule.sequence = sequence;
        await submodule.save({ session });
      });

      await session.endSession();
    } catch (error) {
      await session.endSession();
      throw error;
    }
  } else {
    await submodule.save();
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Topic updated successfully",

    submodule: submodule,
  });
};

// Delete submodule
exports.deleteSubModule = async (req, res) => {
  const submoduleId = req.params.id;

  const targetSubmodule = await SubmoduleModel.findById(submoduleId);
  if (!targetSubmodule) {
    throw new NotFoundError("Targeted topic may not exists");
  }

  const module = targetSubmodule.module;
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
          sequence: { $gt: targetSubmodule.sequence },
        },
        {
          $inc: { sequence: -1 },
        },
        {
          // runValidators: true,
          session,
        }
      );

      await targetSubmodule.deleteOne({ session });
    });

    await session.endSession();
  } catch (error) {
    await session.endSession();
    throw error;
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Topic deleted successfully",
  });
};
