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
  filterUserData,
} = require("../../utils/helperFuns.js");
const OTPManager = require("../../utils/OTPManager.js");
const { appendBucketName } = require("../../utils/helperFuns.js");

//  User's home page content
exports.getHomeContent = async (req, res, next) => {
  const heroSection = HeroSectionModel.findOne();
  const carousal = CarousalModel.find();
  const modules = ModuleModel.find();
  const plans = PlanModel.find();
  const mentors = MentorModel.find();
  const certificate = CertficateAddModel.findOne().lean();
  const faqs = FaqModel.find();
  const mentor = await MentorModel.findOne();

  const data = await Promise.all([
    heroSection,
    carousal,
    modules,
    plans,
    mentors,
    certificate,
    faqs,
    mentor,
  ]);

  const getCertificate = (certificate) => {
    if (!certificate.image) return certificate;
    return { ...data[5], image: appendBucketName(data[5]?.image) };
  };

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      heroSection: data[0],
      carousal: data[1],
      modules: data[2],
      plans: data[3],
      mentors: data[4],
      certificate: getCertificate(data[5]),
      faqs: data[6],
      mentor: data[7],
    },
    message: "Home content fetch successfully",
  });
};

// send auth user details
exports.sendMe = async (req, res) => {
  const userId = req.user._id;

  const user = await userModel.findOne({ _id: userId, isDeleted: false });

  const userData = filterUserData(user);

  res.status(StatusCodes.OK).json({
    success: true,
    data: { user: userData },
    message: "User details fetched successfully",
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
      data: {
        user: {
          _id: user._id,
        },
      },
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
    data: {
      user: {
        _id: user._id,
      },
    },
    message: "Otp sent to registered email or phone number",
  });
};

exports.googleAuth = async (req, res) => {
  // Fetch email
  const { googleToken } = req.body;

  const response = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${googleToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new BadRequestError(`Google login verification failed: ${error}`);
  }

  const data = await response.json();

  // Extract user details
  const { name, picture, email, email_verified } = data;
  if (!email || !email_verified) {
    throw new BadRequestError("Email is inaccessible or not verified");
  }
  let user = await userModel.findOne({ email, isDeleted: false });

  // Signup
  if (!user || !user.isEmailVerified) {
    if (!user) {
      user = await userModel.create({
        email,
        name,
        avatar: picture,
        isEmailVerified: true,
      });
    } else {
      if (name) user.name = name;
      if (picture) user.avatar = picture;
      user.isEmailVerified = true;
      await user.save();
    }
  }

  // Signin
  const deviceId = generateDeviceId(req);
  const ua = getDeviceData(req);

  // Check if user is already logged in on a different device
  detectMultipleSessions({ res, user, currentDeviceId: deviceId });

  await exports.updateSessionAndCreateTokens({
    req,
    res,
    user,
    deviceId,
    ua,
  });

  const userData = filterUserData(user);

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Signin successfully",
    data: { user: userData },
  });
};

// Helper function to check if user is already logged in on a different device
const detectMultipleSessions = ({ res, user, currentDeviceId }) => {
  if (user.activeSessions.length == 0) return;

  const otherDeviceSession = user.activeSessions.find(
    (session) => session.deviceInfo.deviceId !== currentDeviceId
  );
  // const otherDeviceSession = user.activeSessions.find((session) => {
  //   console.log("deviceid1 : ", session.deviceInfo.deviceId);
  //   console.log("deviceid2 : ", currentDeviceId);

  //   return session.deviceInfo.deviceId !== currentDeviceId;
  // });

  if (otherDeviceSession) {
    const payload = getTokenPayload(user);
    const tempToken = createTempToken(payload);
    attachTempTokenToCookies({ res, tempToken });

    throw new ConflictError("You are already logged in on another device");
  }
};

// Helper function to update session and create tokens
exports.updateSessionAndCreateTokens = async ({
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
    (session) =>
      session.deviceInfo.deviceId === deviceId &&
      session.deviceInfo.userAgent === req.headers["user-agent"]
  );

  if (existingSessionIndex >= 0) {
    user.activeSessions[existingSessionIndex] = sessionInfo;
  } else {
    user.activeSessions.push(sessionInfo);
  }
  await user.save();

  attachCookiesToResponse({ res, accessToken, refreshToken, keepMeSignedIn });
  return;
};

// User verification
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

  await exports.updateSessionAndCreateTokens({
    req,
    res,
    user,
    deviceId,
    ua,
    keepMeSignedIn,
  });

  const userData = filterUserData(user);
  return res.status(StatusCodes.OK).json({
    success: true,
    message: "OTP verified successfully",
    data: { user: userData },
  });
};

// Switch device
exports.switchDevice = async (req, res) => {
  const tempToken = req.signedCookies.tempToken;
  const payload = verify_token({ token: tempToken, type: "temp" });

  const existingUser = await getExistingUser(payload.user._id);

  existingUser.activeSessions = [];
  await existingUser.save();

  const deviceId = generateDeviceId(req);
  const ua = getDeviceData(req);
  await exports.updateSessionAndCreateTokens({
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
