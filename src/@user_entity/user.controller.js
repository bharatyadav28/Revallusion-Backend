const StatusCodes = require("http-status-codes");

const HeroSectionModel = require("../@hero_section_entity/heroSection.model");
const CarousalModel = require("../@carousal_entity/carousal.model");
const ModuleModel = require("../@module_entity/module.model");
const PlanModel = require("../@plan_entity/plan.model");
const MentorModel = require("../@mentor_entity/mentor.model");
const CertficateAddModel = require("../@certificate_add_entity/certificateAdd.model");
const FaqModel = require("../@faq_entity/faq.model");
const {
  BadRequestError,
  NotFoundError,
  ConflictError,
} = require("../../errors/index.js");
const { uploadImageToS3 } = require("../../utils/s3");
const userModel = require("./user.model.js");
const {
  createAccessToken,
  createRefreshToken,
  attachCookiesToResponse,
  createTempToken,
  attachTempTokenToCookies,
  verify_token,
} = require("../../utils/jwt.js");
const {
  generateDeviceId,
  getDeviceData,
  getExistingUser,
  getTokenPayload,
} = require("../../utils/helperFuns.js");
const OTPManager = require("../../utils/OTPManager.js");

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

// Signin and Signup
exports.signin = async (req, res) => {
  const { email, password } = req.body;

  // Check required fields
  if (!email) {
    throw new BadRequestError("Please enter email");
  }
  if (!password) {
    throw new BadRequestError("Please enter password");
  }

  let query = { email: email, isDeleted: false };
  let user = await userModel.findOne(query).select("+password");

  let isVerified = user && (user.isMobileVerified || user.isEmailVerified);

  // Signup
  if (!user || !isVerified) {
    if (!user) {
      user = await userModel.create({ email, password });
    } else {
      user.email = email;
      user.password = password;
      await user.save();
    }

    await OTPManager.generateOTP({
      userId: user._id,
      name: user.name || "User",
      email,
      type: "account_verification",
    });

    return res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Otp sent to registered email or phone number",
      userId: user._id,
    });
  }

  // Signin
  const isMatchPassword = await user.comparePassword(password);
  if (!isMatchPassword) {
    throw new BadRequestError("Invalid Password");
  }

  await OTPManager.generateOTP({
    userId: user._id,
    name: user.name || "User",
    email,
    type: "two_step_auth",
  });

  return res.status(StatusCodes.OK).json({
    success: true,
    userId: user._id,
    message: "Otp sent to registered email or phone number",
  });
};

exports.googleAuth = async (req, res) => {
  // Fetch email
  // If no email throw error
  // check if email exists and email is verified, login()
  // else signup(), user email verified = true
  // token
};

// Helper function to check if user is already logged in on a different device
const detectMultipleSessions = ({ res, user, currentDeviceId }) => {
  const otherDeviceSession = user.activeSessions.find(
    (session) => session.deviceInfo.deviceId !== currentDeviceId
  );

  if (true) {
    const payload = getTokenPayload(user);
    const tempToken = createTempToken(payload);
    attachTempTokenToCookies({ res, tempToken });

    throw new ConflictError("You are already logged in on another device");
  }
};

// Helper function to update session and create tokens
const updateSessionAndCreateTokens = async ({
  req,
  res,
  user,
  deviceId,
  ua,
  keepMeSignedIn = false,
}) => {
  const tokenPayoad = getTokenPayload(user);
  const accessToken = createAccessToken(tokenPayoad);
  const refreshToken = createRefreshToken(tokenPayoad, keepMeSignedIn);

  // Update or add session information
  const sessionInfo = {
    refreshToken,
    deviceInfo: {
      deviceId,
      userAgent: req.headers["user-agent"],
      browser: `${ua.browser.name} ${ua.browser.version}`,
      os: `${ua.os.name} ${ua.os.version}`,
      lastUsed: new Date(),
    },
  };

  // Find and update existing session for this device or add new one
  const existingSessionIndex = user.activeSessions.findIndex(
    (session) => session.deviceInfo.deviceId === deviceId
  );

  if (existingSessionIndex >= 0) {
    user.activeSessions[existingSessionIndex] = sessionInfo;
  } else {
    user.activeSessions.push(sessionInfo);
  }
  await user.save();

  attachCookiesToResponse({ res, accessToken, refreshToken });
  return;
};

exports.verifyUser = async (req, res) => {
  const { otp, email, type, userId, keepMeSignedIn } = req.body;

  if (!email) {
    throw new BadRequestError("Please provide email");
  }

  const user = await getExistingUser(userId);
  if (user.isEmailVerified && type === "account_verification") {
    throw new BadRequestError("User is already verified");
  }

  let query = { otp, type, userId, email };
  await OTPManager.verifyOTP(query);
  if (type === "account_verification") user.isEmailVerified = true;

  const deviceId = generateDeviceId(req);
  const ua = getDeviceData(req);

  // Check if user is already logged in on a different device
  detectMultipleSessions({ res, user, currentDeviceId: deviceId });

  await updateSessionAndCreateTokens({
    req,
    res,
    user,
    deviceId,
    ua,
    keepMeSignedIn,
  });

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "OTP verified successfully",
    user,
  });
};

exports.switchDevice = async (req, res) => {
  const tempToken = req.signedCookies.tempToken;
  const payload = verify_token({ token: tempToken, type: "temp" });

  const existingUser = await getExistingUser(payload.user._id);

  existingUser.activeSessions = [];
  await existingUser.save();

  const deviceId = generateDeviceId(req);
  const ua = getDeviceData(req);
  await updateSessionAndCreateTokens({
    req,
    res,
    user: existingUser,
    deviceId,
    ua,
  });

  res.clearCookie("tempToken");
  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Device switched successfully",
  });
};

exports.logout = async (req, res) => {
  const { refreshToken } = req.signedCookies;
  const deviceId = generateDeviceId(req);

  const user = await userModel.findOne({
    _id: req.user._id,
    isDeleted: false,
  });
  if (!user) {
    throw new NotFoundError("User not found");
  }

  // Remove current ssession from user model
  user.activeSessions = user.activeSessions?.filter(
    (session) =>
      !(
        session.refreshToken === refreshToken &&
        session.deviceInfo.deviceId === deviceId
      )
  );
  await user.save();

  // clear token cookies
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.clearCookie("tempToken");

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Logout successfully",
  });
};
