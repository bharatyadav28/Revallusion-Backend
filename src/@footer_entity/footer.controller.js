const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");

const FooterModel = require("./footer.model.js");
const { NotFoundError, BadRequestError } = require("../../errors/index.js");
const { extractURLKey, awsUrl } = require("../../utils/helperFuns.js");

// Create a footer item
exports.createFooter = async (req, res) => {
  let { name, iconPath, url } = req.body;

  if (!iconPath || !url) {
    throw new BadRequestError("Please provide  iconPath, and url");
  }

  iconPath = extractURLKey(iconPath);

  const footer = await FooterModel.create({
    name,
    iconPath,
    url,
  });

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: "Footer item created successfully",
  });
};

// Get all footer items
exports.getFooters = async (req, res) => {
  const footers = await FooterModel.aggregate([
    {
      $sort: { createdAt: -1 },
    },
    {
      $set: {
        iconPath: {
          $concat: [awsUrl, "/", "$iconPath"],
        },
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        iconPath: 1,
        url: 1,
      },
    },
  ]);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Footer items fetched successfully",
    data: { footers },
  });
};

// Get a single footer item by ID
exports.getFooterById = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new BadRequestError("Invalid footer ID");
  }

  const footer = await FooterModel.findById(id);

  if (!footer) {
    throw new NotFoundError("Footer item not found");
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Footer item fetched successfully",
    data: { footer },
  });
};

// Update a footer item
exports.updateFooter = async (req, res) => {
  const { id } = req.params;
  let { name, iconPath, url } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    throw new BadRequestError("Invalid footer ID");
  }

  const footer = await FooterModel.findById(id);

  if (!footer) {
    throw new NotFoundError("Footer item not found");
  }

  // Update fields if provided
  if (name !== undefined) footer.name = name;
  if (iconPath !== undefined) footer.iconPath = extractURLKey(iconPath);
  if (url !== undefined) footer.url = url;

  await footer.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Footer item updated successfully",
  });
};

// Delete a footer item
exports.deleteFooter = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new BadRequestError("Invalid footer ID");
  }

  const footer = await FooterModel.findById(id);

  if (!footer) {
    throw new NotFoundError("Footer item not found");
  }

  await FooterModel.findByIdAndDelete(id);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Footer item deleted successfully",
  });
};
