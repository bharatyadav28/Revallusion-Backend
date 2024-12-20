const { StatusCodes } = require("http-status-codes");

const faqModel = require("./faq.model.js");
const { NotFoundError } = require("../../errors/index.js");

// Add a faq
exports.addFaq = async (req, res) => {
  const { title, description, status } = req.body;
  const faq = await faqModel.create({ title, description, status });

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: "New Faq Created Successfully",
  });
};

// Get all faqs
exports.getFaqs = async (req, res) => {
  const faqs = await faqModel.find().lean();
  res.status(StatusCodes.OK).json({
    success: true,
    data: { faqs, count: faqs.length },
    message: "Faqs fetch successfully",
  });
};

// Delete a faq
exports.deleteFaq = async (req, res, next) => {
  const faq = await faqModel.findByIdAndDelete(req.params.id);
  if (!faq) {
    throw new NotFoundError("Faq not found");
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Faq Deleted successfully",
  });
};

// Get a single faq
exports.getFaq = async (req, res, next) => {
  const faq = await faqModel.findById(req.params.id);
  if (!faq) {
    throw new NotFoundError("Faq not found");
  }
  res.status(StatusCodes.OK).json({
    success: true,
    data: { faq },
    message: "Faq fetch successfully",
  });
};

// Update a faq
exports.updateFaq = async (req, res, next) => {
  const faq = await faqModel.findById(req.params.id);
  const { title, description, status } = req.body;
  if (!faq) {
    throw new NotFoundError("Faq not found");
  }
  if (title) faq.title = title;
  if (description) faq.description = description;
  if (status) faq.status = status;
  await faq.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Faq updated successfully",
  });
};
