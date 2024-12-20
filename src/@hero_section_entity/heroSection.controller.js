const { StatusCodes } = require("http-status-codes");
const HeroSectionModal = require("./heroSection.model.js");

const { NotFoundError } = require("../../errors");

// Add or update  hero section
exports.addHeroSection = async (req, res) => {
  const { caption, description } = req.body;

  const heroSection = await HeroSectionModal.findOne();

  if (heroSection) {
    if (caption) heroSection.caption = caption;
    if (description) heroSection.description = description;
    await heroSection.save();
  } else {
    await HeroSectionModal.create({ caption, description });
  }

  const statusCode = heroSection ? StatusCodes.OK : StatusCodes.CREATED;
  const message = heroSection
    ? "Hero Section updated successfully"
    : "Hero Section created successfully";

  res.status(statusCode).json({
    success: true,
    message: message,
  });
};

// Get hero section
exports.getHeroSection = async (req, res, next) => {
  const data = await HeroSectionModal.findOne();
  if (!data) {
    throw new NotFoundError("Hero Section not found");
  }
  res.status(StatusCodes.OK).json({
    success: true,
    data: { heroSection: data },
    message: "Hero Section fetch successfully",
  });
};

// Delete hero section
exports.deleteHeroSection = async (req, res, next) => {
  const data = await HeroSectionModal.deleteMany();
  if (!data) {
    throw new NotFoundError("Hero Section not found");
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Hero Section deleted successfully",
  });
};
