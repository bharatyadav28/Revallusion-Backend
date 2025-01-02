const UAParser = require("ua-parser-js");

const userModel = require("../src/@user_entity/user.model");
const { NotFoundError } = require("../errors/index");

exports.getDeviceData = (req) => {
  const parser = new UAParser(req.headers["user-agent"]);
  const ua = parser.getResult();
  return ua;
};

exports.generateDeviceId = (req) => {
  const ua = exports.getDeviceData(req);

  // Create a unique device identifier using multiple factors
  const deviceFactors = [
    ua.os.name,
    ua.os.version,
    ua.engine.name,
    ua.cpu.architecture,
    req.headers["accept-language"],
    req.ip, // IP address as part of device fingerprint
  ]
    .filter(Boolean)
    .join("|");

  return require("crypto")
    .createHash("sha256")
    .update(deviceFactors)
    .digest("hex");
};

exports.getTokenPayload = (user) => {
  return { user: { _id: user._id } };
};

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
