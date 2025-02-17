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

// Add a new submodule inside module
exports.addSubModule = async (req, res) => {
  const { moduleId, name, thumbnailUrl } = req.body;

  if (!name) throw new BadRequestError("Please enter submodule name");

  const module = await CourseModuleModel.findOne({
    _id: moduleId,
  });
  if (!module) throw new NotFoundError("Requested module may not exists");

  // Get sequence number for new submodue
  const sequence = await SubmoduleModel.getNextSequence(moduleId);

  const thumbnailPath = extractURLKey(thumbnailUrl);

  // Add the submodule
  const submodule = await SubmoduleModel.create({
    module: moduleId,
    name,
    sequence,
    thumbnailUrl: thumbnailPath,
  });

  if (!submodule) {
    throw new BadRequestError("Failed to add submodule");
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Submodule added successfully",
  });
};

// Update a submodule present in a module
exports.updateSubModule = async (req, res) => {
  let { name, thumbnailUrl, newModuleId, sequence } = req.body;
  if (!name) throw new BadRequestError("Please enter submodule name");

  const { id: submoduleId } = req.params;

  // const module = course.modules.id(moduleId);
  // if (!module) throw new NotFoundError("Requested module may not exists");

  const submodule = await SubmoduleModel.findById(submoduleId);
  if (!submodule) throw new NotFoundError("Requested submodule may not exists");

  if (name) submodule.name = name;
  if (thumbnailUrl) {
    const thumbnailPath = extractURLKey(thumbnailUrl);

    submodule.thumbnailUrl = thumbnailPath;
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
    message: "Submodule updated successfully",

    submodule: submodule,
  });
};

// Get all resources of a submodule
exports.getResources = async (req, res) => {
  const { id } = req.params;

  const [submodule] = await SubmoduleModel.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(id),
      },
    },

    {
      $addFields: {
        resources: {
          $map: {
            input: "$resources", // Loop through resources array
            as: "resource", // Alias each element as 'resource'
            in: {
              _id: "$$resource._id", // Keep original _id
              url: { $concat: [awsUrl, "/", "$$resource.url"] }, // Append awsUrl
            },
          },
        },
      },
    },
  ]);
  // const submodule = await SubmoduleModel.findById(id);
  if (!submodule) {
    throw new NotFoundError("Requested submodule may not exists");
  }
  res.status(StatusCodes.OK).json({
    success: true,
    message: "Resources fetched successfully",
    data: {
      resources: submodule?.resources || [],
    },
  });
};

// Add a resource inside submodule
exports.addResource = async (req, res) => {
  const { id } = req.params;

  if (!req.files || req.files.length === 0) {
    throw new BadRequestError("Please upload a file");
  }

  const submodule = await SubmoduleModel.findById(id);
  if (!submodule) {
    throw new NotFoundError("Requested submodule may not exists");
  }

  const results = await s3UploadMulti(req.files);

  const filePaths = results.map((result) => {
    return { url: result.Key };
  });

  if (!submodule.resources) submodule.resources = [];
  submodule.resources.push(...filePaths);
  await submodule.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Resource added successfully",
  });
};

exports.deleteResource = async (req, res) => {
  const { id, rid } = req.params;

  const submodule = await SubmoduleModel.findById(id);
  if (!submodule) {
    throw new NotFoundError("Requested submodule may not exists");
  }
  const resources = submodule?.resources || [];

  const resource = resources.find((resource) =>
    resource._id.equals(StringToObjectId(rid))
  );
  if (!resource) {
    throw new NotFoundError("Requested resource may not exists");
  }

  // Remove resource from submodule
  submodule.resources = resources.filter(
    (resource) => !resource._id.equals(StringToObjectId(rid))
  );
  await submodule.save();

  // Delete resource from s3
  await s3delete(resource.url);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Resource deleted successfully",
  });
};
