const { UnauthenticatedError, UnAuthorizedError } = require("../errors");
const userModel = require("../src/@user_entity/user.model");
const {
  generateDeviceId,
  getExistingUser,
  getTokenPayload,
} = require("../utils/helperFuns");
const {
  verify_token,
  createAccessToken,
  attachAccessTokenToCookies,
} = require("../utils/jwt");

// Check if the session is valid
const validateSession = async ({ user, deviceId, refreshToken }) => {
  const session = user.activeSessions.find(
    (s) => s.deviceInfo.deviceId === deviceId && s.refreshToken === refreshToken
  );

  if (!session) {
    throw new UnauthenticatedError("Invalid session");
  }

  // Update session's last used timestamp
  session.deviceInfo.lastUsed = new Date();
  await user.save();

  return session;
};

// Attach user details (token) to req object
const attachUserToReq = (req, user) => {
  req.user = { _id: user._id, role: user.role };
  return;
};

// Generate new access token using if refresh token is valid
const handleTokenRefresh = async ({ req, res, refreshToken }) => {
  const refreshTokenPayload = verify_token({
    token: refreshToken,
    type: "refresh",
  });
  const userId = refreshTokenPayload.user._id;
  const existingUser = await getExistingUser(userId);

  const deviceId = generateDeviceId(req);

  // Validate session
  await validateSession({
    user: existingUser,
    deviceId,
    refreshToken,
  });

  // Create new access token
  const tokenPayload = getTokenPayload(existingUser);
  const newAccessToken = createAccessToken(tokenPayload);
  attachAccessTokenToCookies({ res, accessToken: newAccessToken });
  attachUserToReq(req, existingUser);

  return;
};

// Authentication middleware
exports.auth = async (req, res, next) => {
  const { accessToken, refreshToken } = req.signedCookies;

  if (!accessToken && !refreshToken) {
    throw new UnauthenticatedError("Session expired, please login again");
  }

  try {
    const accessTokenpayload = verify_token({
      token: accessToken,
      type: "access",
    });

    const userId = accessTokenpayload.user._id;
    const existingUser = await getExistingUser(userId);

    attachUserToReq(req, existingUser);

    const deviceId = generateDeviceId(req);

    // Validate session
    await validateSession({
      user: existingUser,
      deviceId,
      refreshToken,
    });

    return next();
  } catch (accessError) {
    console.log("!!! Error in access token: ", accessError.message);

    // Check for refresh token validation
    if (
      refreshToken &&
      (accessError.name === "TokenExpiredError" || !accessToken)
    ) {
      try {
        await handleTokenRefresh({ req, res, refreshToken });

        return next();
      } catch (refreshError) {
        console.log("!!! Error in refresh token: ", refreshError.message);

        // Clear cookies (invalid access and refresh token)
        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");
        throw new UnauthenticatedError("Session expired, please login again");
      }
    } else {
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");
      throw new UnauthenticatedError(
        accessError.message || "Not authorized to access this route"
      );
    }
  }
};

exports.isAdmin = async (req, res, next) => {
  const user = await userModel.findById(req.user._id);

  if (!user || user.role !== "admin") {
    throw new UnAuthorizedError("Not authorized to access this route");
  }

  return next();
};
