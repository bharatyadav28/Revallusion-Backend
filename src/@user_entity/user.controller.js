const StatusCodes = require("http-status-codes");

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
  appendBucketName,
} = require("../../utils/helperFuns.js");
const OTPManager = require("../../utils/OTPManager.js");
const OrderModel = require("../@order_entity/order.model.js");
const { s3Uploadv4 } = require("../../utils/s3.js");
const { default: mongoose } = require("mongoose");

// send auth user details
exports.sendMe = async (req, res) => {
  const userId = req.user._id;
  const role = req.user.role;

  if (role !== "user") throw new BadRequestError("Only end users can access");

  const userPromise = userModel
    .findOne({ _id: userId, isDeleted: false })
    .select("_id name email mobile role isEmailVerified avatar")
    .lean();

  const orderPromise = OrderModel.exists({
    user: userId,
    status: "Active",
  });

  const [user, order] = await Promise.all([userPromise, orderPromise]);

  if (user.avatar) {
    user.avatar = appendBucketName(user.avatar);
  }

  let hasSubscription = false;
  if (order) hasSubscription = true;

  res.status(StatusCodes.OK).json({
    success: true,
    data: { user: { ...user, hasSubscription } },
    message: "User details fetched successfully",
  });
};

// Signin and Signup
exports.signin = async (req, res) => {
  const { email } = req.body;

  // Check required fields
  if (!email) {
    throw new BadRequestError("Please enter email");
  }

  let query = { email: email, isDeleted: false };
  let user = await userModel.findOne(query).select("+password");

  let isVerified = user && (user.isMobileVerified || user.isEmailVerified);

  // Signup
  if (!user || !isVerified) {
    if (!user) {
      user = await userModel.create({ email });
    } else {
      user.email = email;
      // user.password = password;
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
        isNewUser: true,
      },
    });
  }

  // Signin
  // const isMatchPassword = await user.comparePassword(password);
  // if (!isMatchPassword) {
  //   throw new BadRequestError("Invalid Password");
  // }

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
      isNewUser: false,
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
    if (user.role !== "user" && user.activeSessions.length >= 5) {
      // Only 5 active logins for admin/staff
      user.activeSessions.shift();
    }
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

exports.updateAvatar = async (req, res) => {
  const userId = req.user._id;
  const file = req.file;

  if (!file || !file?.mimetype.split("/")[0] === "image") {
    throw new BadRequestError("Please upload an image");
  }

  const result = await s3Uploadv4(file, userId);

  const user = await userModel.findByIdAndUpdate(
    userId,
    {
      avatar: result.Key,
    },
    {
      runValidators: true,
      new: true,
    }
  );

  if (!user) {
    throw new BadRequestError("Profile image updation failed");
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Avatar updated successfully",
    data: {
      avatar: appendBucketName(result.key),
    },
  });
};

exports.updateName = async (req, res) => {
  const userId = req.user._id;
  const { name } = req.body;

  if (!name) {
    throw new BadRequestError("Please enter name");
  }

  const user = await userModel.findByIdAndUpdate(
    userId,
    {
      name,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!user) {
    throw new BadRequestError("Name updation failed");
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Name updated successfully",
    data: {
      name: user.name,
    },
  });
};

exports.updateMobile = async (req, res) => {
  const userId = req.user._id;
  const { mobile } = req.body;

  if (!mobile) {
    throw new BadRequestError("Please enter phone number");
  }

  const user = await userModel.findByIdAndUpdate(
    userId,
    {
      mobile,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!user) {
    throw new BadRequestError("Phone number updation failed");
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Phone number updated successfully",
    data: {
      mobile: user.mobile,
    },
  });
};

exports.deleteAccount = async (req, res) => {
  const userId = req.user._id;

  // const deletedAccount = await userModel.findByIdAndDelete(userId);
  const deletedAccount = await userModel.findByIdAndUpdate(userId, {
    isDeleted: true,
    deletedAt: new Date(),
  });
  if (!deletedAccount) {
    throw new BadRequestError("Account deletion failed.");
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Account deleted successfully",
  });
};
