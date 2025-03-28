const { StatusCodes } = require("http-status-codes");

const ModuleModel = require("./module.model.js");
const { NotFoundError } = require("../../errors/index.js");

//  Create new module
exports.createModule = async (req, res, next) => {
  const module = await ModuleModel.create(req.body);
  res.status(StatusCodes.CREATED).json({
    success: true,
    data: { module },
    message: "Module created successfully",
  });
};

// Fetch all modules
exports.getModules = async (req, res) => {
  const modules = await ModuleModel.find().sort({ name: 1 }).lean();

  res.status(StatusCodes.OK).json({
    success: true,
    data: { modules, count: modules.length },
    message: "Modules fetch successfully",
  });
};

// Fetch a single module
exports.getModule = async (req, res, next) => {
  const module = await ModuleModel.findById(req.params.id);
  if (!module) throw new NotFoundError("Module not found");

  res.status(StatusCodes.OK).json({
    success: true,
    data: { module },
    message: "Module fetched successfully",
  });
};

// Update module
exports.updateModule = async (req, res, next) => {
  const module = await ModuleModel.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!module) throw new NotFoundError("Module not found");

  res.status(StatusCodes.OK).json({
    success: true,
    data: { module },
    message: "Module updated successfully",
  });
};

// Delete module
exports.deleteModule = async (req, res, next) => {
  const module = await ModuleModel.findById(req.params.id);
  if (!module) throw new NotFoundError("Module not found");
  await module.deleteOne();

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Module Deleted successfully",
  });
};
