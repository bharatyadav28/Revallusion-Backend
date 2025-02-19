// Controllers for (Terms_and_conditions, privacy_policy, pricing_policy, refund_policy pages etc.)

const { StatusCodes } = require("http-status-codes");

const PageModel = require("./page.model.js");
const { NotFoundError } = require("../../errors/index.js");

// Add a page
exports.addPage = async (req, res, next) => {
  const { title, description, status } = req.body;

  const page = await PageModel.create({
    title,
    description,
    status,
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
  const { title, description, status } = req.body;

  if (title) page.title = title;
  if (description) page.description = description;
  if (status) page.status = status;
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

exports.getPricingPolicy = async (req, res, next) => {
  const page = await PageModel.findOne({ title: "Pricing Policy" }).select({
    title: 1,
    description: 1,
  });
  if (!page) throw new NotFoundError("Page not found");

  res.status(StatusCodes.OK).json({
    success: true,
    data: { page },
    message: "Page fetch successfully",
  });
};

exports.getTermsAndConditions = async (req, res, next) => {
  const page = await PageModel.findOne({
    title: "Terms and Conditions",
  }).select({
    title: 1,
    description: 1,
  });
  if (!page) throw new NotFoundError("Page not found");

  res.status(StatusCodes.OK).json({
    success: true,
    data: { page },
    message: "Page fetch successfully",
  });
};

exports.getPrivacyPolicy = async (req, res, next) => {
  const page = await PageModel.findOne({
    title: "Privacy Policy",
  }).select({
    title: 1,
    description: 1,
  });
  if (!page) throw new NotFoundError("Page not found");

  res.status(StatusCodes.OK).json({
    success: true,
    data: { page },
    message: "Page fetch successfully",
  });
};

exports.getRefundPolicy = async (req, res, next) => {
  const page = await PageModel.findOne({
    title: "Refund Policy",
  }).select({
    title: 1,
    description: 1,
  });
  if (!page) throw new NotFoundError("Page not found");

  res.status(StatusCodes.OK).json({
    success: true,
    data: { page },
    message: "Page fetch successfully",
  });
};

exports.getAboutUs = async (req, res, next) => {
  const page = await PageModel.findOne({
    title: "About Us",
  }).select({
    title: 1,
    description: 1,
  });
  if (!page) throw new NotFoundError("Page not found");

  res.status(StatusCodes.OK).json({
    success: true,
    data: { page },
    message: "Page fetch successfully",
  });
};
