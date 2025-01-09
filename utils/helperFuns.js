const UAParser = require("ua-parser-js");

const userModel = require("../src/@user_entity/user.model");
const { NotFoundError } = require("../errors/index");

// Get device info
exports.getDeviceData = (req) => {
  const parser = new UAParser(req.headers["user-agent"]);
  const ua = parser.getResult();
  return ua;
};

// Generate unqiue device identifier
exports.generateDeviceId = (req) => {
  const ua = exports.getDeviceData(req);

  // Create a unique device identifier using multiple factors
  const deviceFactors = [
    ua.os.name,
    req.ip, // IP address as part of device fingerprint

    // ua.os.name,          // OS name (e.g., macOS, Windows, Android)
    // ua.os.version,       // OS version (e.g., 10.15.7, 11.0)
    // ua.device.type || "desktop", // Device type (e.g., desktop, mobile)
    // ua.cpu.architecture || "x64", // CPU architecture (e.g., x64, arm64)
  ]
    .filter(Boolean)
    .join("|");

  return require("crypto")
    .createHash("sha256")
    .update(deviceFactors)
    .digest("hex");
};

// Token meta data
exports.getTokenPayload = (user) => {
  return { user: { _id: user._id } };
};

// Get user details by id
exports.getExistingUser = async (userId) => {
  const existingUser = await userModel.findOne({
    _id: userId,
    isDeleted: false,
  });
  if (!existingUser) {
    throw new NotFoundError("User not found");
  }
  return existingUser;
};

// Filter user data for fronend
exports.filterUserData = (user) => {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    isMobileVerified: user.isMobileVerified,
  };
};

// Extract path form AWS bucket url
exports.extractURLKey = (url) => {
  return url.replace(/^https?:\/\/[^/]+\/(.+)$/, "$1");
};

// Append AWS bucket name before the file path
exports.appendBucketName = (url) => {
  return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_BUCKET_REGION}.amazonaws.com/${url}`;
};
