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
    .select("_id name email mobile role isEmailVerified avatar address")
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
      message: "Otp sent to registered email",
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
        // avatar: picture,
        isEmailVerified: true,
      });
    } else {
      if (name) user.name = name;
      // if (picture) user.avatar = picture;
      user.isEmailVerified = true;
      await user.save();
    }
  }

  // Signin
  const deviceId = generateDeviceId(req);
  const ua = getDeviceData(req);

  // Check if user is already logged in on a different device
  detectMultipleSessions({ res, user, ip: req.ip, os: ua.os.name });

  await exports.updateSessionAndCreateTokens({
    req,
    res,
    user,
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
const detectMultipleSessions = ({ res, user, ip, os }) => {
  if (!user?.activeSessions?.ip) {
    return;
  }

  const otherDeviceSession = !(
    String(user?.activeSessions?.ip) === String(ip) &&
    String(user?.activeSessions?.os) === String(os)
  );
  console.log("Detect multiple session");

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
  ua,
  keepMeSignedIn = false,
  isNewDevice = false,
}) => {
  console.log("updateSessionAndCreateTokens");
  user = await userModel.findById(user._id);
  const tokenPayoad = getTokenPayload(user);
  const accessToken = createAccessToken(tokenPayoad);
  const refreshToken = createRefreshToken(tokenPayoad, keepMeSignedIn);
  const activeSessions = user?.activeSessions || {};

  const savedRefreshTokens = activeSessions?.refreshTokens;

  activeSessions.ip = req.ip;
  activeSessions.os = ua.os.name || "test";

  if (isNewDevice || !activeSessions?.primaryBrowser) {
    console.log("Is new device");
    activeSessions.primaryBrowser = ua?.browser?.name || "postman";
    activeSessions.refreshTokens = [refreshToken];
  } else {
    activeSessions.refreshTokens = savedRefreshTokens
      ? [...savedRefreshTokens, refreshToken]
      : [refreshToken];
  }

  user.activeSessions = activeSessions;

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
  if (type === "account_verification") {
    user.isEmailVerified = true;
    await user.save();
  }

  const ua = getDeviceData(req);

  // Check if user is already logged in on a different device
  detectMultipleSessions({ res, user, ip: req.ip, os: ua.os.name });

  await exports.updateSessionAndCreateTokens({
    req,
    res,
    user,
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

  const ua = getDeviceData(req);
  await exports.updateSessionAndCreateTokens({
    req,
    res,
    user: existingUser,
    ua,
    isNewDevice: true,
  });

  res.clearCookie("tempToken");
  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Device switched successfully",
  });
};

exports.logout = async (req, res) => {
  const { refreshToken } = req.signedCookies;

  const user = await userModel.findOne({
    _id: req.user._id,
    isDeleted: false,
  });
  if (!user) {
    throw new NotFoundError("User not found");
  }

  // Remove current session from user model
  user.activeSessions.refreshTokens =
    user.activeSessions?.refreshTokens?.filter(
      (token) => token !== refreshToken
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

  const result = await s3Uploadv4(file, "profile");

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
    throw new BadRequestError("Profile pic updation failed");
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Profile pic updated successfully",
    data: {
      avatar: appendBucketName(result.key),
    },
  });
};

exports.removeAvatar = async (req, res) => {
  const userId = req.user._id;

  const user = await userModel.findByIdAndUpdate(
    userId,
    {
      avatar: "",
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
    message: "Profile pic removed successfully",
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

exports.updateAddress = async (req, res) => {
  const userId = req.user._id;
  const { address } = req.body;

  if (!address) {
    throw new BadRequestError("Please enter address");
  }

  const user = await userModel.findByIdAndUpdate(
    userId,
    {
      address,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!user) {
    throw new BadRequestError("Address updation failed");
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Address updated successfully",
    data: {
      address: user.address,
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

  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.clearCookie("tempToken");

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Account deleted successfully",
  });
};
