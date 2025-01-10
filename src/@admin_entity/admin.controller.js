const userModel = require("../@user_entity/user.model");
const StatusCodes = require("http-status-codes");
const { NotFoundError, BadRequestError } = require("../../errors");
const {
  updateSessionAndCreateTokens,
} = require("../@user_entity/user.controller");
const {
  generateDeviceId,
  getDeviceData,
  filterUserData,
} = require("../../utils/helperFuns");
const { s3AdminUploadv4 } = require("../../utils/s3");

// Admin signin
exports.adminSignin = async (req, res) => {
  const { email, password, keepMeSignedIn } = req.body;

  // Check required fields
  if (!email) {
    throw new BadRequestError("Please enter email");
  }
  if (!password) {
    throw new BadRequestError("Please enter password");
  }

  let query = { email: email, isDeleted: false, role: "admin" };
  let user = await userModel.findOne(query).select("+password");

  if (!user || !user.isEmailVerified) {
    throw new NotFoundError("Incorrect email or password");
  }

  const isMatchPassword = await user.comparePassword(password);
  if (!isMatchPassword) {
    throw new BadRequestError("Invalid Password");
  }

  await updateSessionAndCreateTokens({
    req,
    res,
    user,
    deviceId: generateDeviceId(req),
    ua: getDeviceData(req),
    keepMeSignedIn: keepMeSignedIn || false,
  });

  const userData = filterUserData(user);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Signin successfully",
    data: { user: userData },
  });
};

// Update profile
exports.adminUpdateProfile = async (req, res) => {
  const { name, email, password } = req.body;

  const user = await userModel.findOne({
    _id: req.user._id,
    isDeleted: false,
    role: "admin",
  });
  if (!user) {
    return BadRequestError("Somenthing went wrong while updating profile");
  }

  if (name) user.name = name;
  if (email) user.email = email;
  if (password) user.password = password;
  await user.save();

  const userData = filterUserData(user);

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Profile updated successfully",
    data: { user: userData },
  });
};

// Upload image
exports.uploadImage = async (req, res) => {
  if (!req.file) {
    throw new BadRequestError("Please upload an image");
  }

  // Get file type
  const fileType = req.file.mimetype.split("/")[0];

  let uploadResult;
  if (fileType === "image") {
    uploadResult = await s3AdminUploadv4(req.file);
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
