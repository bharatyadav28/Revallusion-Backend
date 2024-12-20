// Controllers for (Terms_and_conditions, privacy_policy, pricing_policy, refund_policy pages etc.)

const { StatusCodes } = require("http-status-codes");

const PageModel = require("./page.model.js");
const { NotFoundError } = require("../../errors/index.js");

// Add a page
exports.addPage = async (req, res, next) => {
  const { title, description, status, type } = req.body;

  const page = await PageModel.create({
    title,
    description,
    status,
    type,
  });

  res.status(StatusCodes.CREATED).json({
    success: true,
    data: { page },
    message: "Page Created Successfully",
  });
};

// Fetch all pages
exports.getPages = async (req, res, next) => {
  const pages = await PageModel.find().lean();

  res.status(StatusCodes.OK).json({
    success: true,
    data: { pages },
    message: "Pages fetch successfully",
  });
};

// Fetch a single page
exports.getPage = async (req, res, next) => {
  const page = await PageModel.findById(req.params.id);
  if (!page) throw new NotFoundError("Page not found");

  res.status(StatusCodes.OK).json({
    success: true,
    data: { page },
    message: "Page fetch successfully",
  });
};

// Update a page
exports.updatePage = async (req, res, next) => {
  const page = await PageModel.findById(req.params.id);
  if (!page) throw new NotFoundError("Page not found");
  const { title, description, status, type } = req.body;

  if (title) page.title = title;
  if (description) page.description = description;
  if (status) page.status = status;
  if (type) page.type = type;
  await page.save();

  res.status(200).json({
    success: true,
    message: "Page updated successfully",
  });
};

// Delete a page
exports.deletePage = async (req, res, next) => {
  const page = await PageModel.findByIdAndDelete(req.params.id);
  if (!page) throw new NotFoundError("Page not found");

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Page Deleted successfully",
  });
};
