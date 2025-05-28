const { StatusCodes } = require("http-status-codes");

const faqModel = require("./faq.model.js");
const { NotFoundError, BadRequestError } = require("../../errors/index.js");

// Add a faq
exports.addFaq = async (req, res) => {
  const { title, description, status } = req.body;
  const existingFaq = await faqModel.findOne({ title });
  if (existingFaq) {
    throw new BadRequestError("Title must be unique");
  }

  const faq = await faqModel.create({ title, description, status });

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: "New Faq Created Successfully",
  });
};

// Get all faqs
exports.getFaqs = async (req, res) => {
  const { currentPage } = req.query;

  const page = currentPage || 1;
  const limit = 8;
  const skip = (page - 1) * limit;

  const faqsPromise = faqModel.find().skip(skip).limit(limit).lean();
  const totalFaqsPromise = faqModel.countDocuments();

  const [faqs, totalFaqs] = await Promise.all([faqsPromise, totalFaqsPromise]);
  const pagesCount = Math.ceil(totalFaqs / limit) || 1;

  res.status(StatusCodes.OK).json({
    success: true,
    data: { faqs, pagesCount },
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
  if (title !== faq.title) {
    const existingFaq = await faqModel.findOne({ title });
    if (existingFaq) {
      throw new BadRequestError("Title must be unique");
    }
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
