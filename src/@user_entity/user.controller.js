const StatusCodes = require("http-status-codes");

const HeroSectionModel = require("../@hero_section_entity/heroSection.model");
const CarousalModel = require("../@carousal_entity/carousal.model");
const ModuleModel = require("../@module_entity/module.model");
const PlanModel = require("../@plan_entity/plan.model");
const MentorModel = require("../@mentor_entity/mentor.model");
const CertficateAddModel = require("../@certificate_add_entity/certificateAdd.model");
const FaqModel = require("../@faq_entity/faq.model");
const { BadRequestError } = require("../../errors/index.js");
const { uploadImageToS3 } = require("../../utils/s3");

//  User's home page content
exports.getHomeContent = async (req, res, next) => {
  const heroSection = HeroSectionModel.findOne();
  const carousal = CarousalModel.find();
  const modules = ModuleModel.find();
  const plans = PlanModel.find();
  const mentors = MentorModel.find();
  const certificates = CertficateAddModel.find();
  const faqs = FaqModel.find();
  const mentor = await MentorModel.findOne();

  const data = await Promise.all([
    heroSection,
    carousal,
    modules,
    plans,
    mentors,
    certificates,
    faqs,
    mentor,
  ]);

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      heroSection: data[0],
      carousal: data[1],
      modules: data[2],
      plans: data[3],
      mentors: data[4],
      certificates: data[5],
      faqs: data[6],
      mentor: data[7],
    },
    message: "Home content fetch successfully",
  });
};

// Upload image
exports.uploadImage = async (req, res) => {
  if (!req.file) {
    throw new BadRequestError("Please upload an image");
  }

  const user = req.userID || "admin";

  // Get file type
  const fileType = req.file.mimetype.split("/")[0];

  let uploadResult;
  if (fileType === "image") {
    uploadResult = await uploadImageToS3(req.file, user);
  } else {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "Unsupported file type" });
  }

  // Generate image URL
  const result = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_BUCKET_REGION}.amazonaws.com/${uploadResult.Key}`;

  return res.status(StatusCodes.OK).json({
    success: true,
    data: { imageUrl: result },
    message: "Image uploaded successfully",
  });
};
