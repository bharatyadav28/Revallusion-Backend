const { UnauthenticatedError, UnAuthorizedError } = require("../errors");
const userModel = require("../src/@user_entity/user.model");
const {
  generateDeviceId,
  getExistingUser,
  getTokenPayload,
  getDeviceData,
} = require("../utils/helperFuns");
const {
  verify_token,
  createAccessToken,
  attachAccessTokenToCookies,
} = require("../utils/jwt");

// Check if the session is valid
const validateSession = async ({
  user,
  ip,
  os,
  refreshToken,
  browser = "postman",
}) => {
  const isValidToken = user.activeSessions.refreshTokens.includes(refreshToken);

  console.log("Valid refresh token", isValidToken);

  if (!isValidToken) {
    throw new UnauthenticatedError("Invalid session");
  }

  if (user.activeSessions.ip !== ip)
    if (
      user.activeSessions.primaryBrowser === browser &&
      user.activeSessions.os === os
    ) {
      user.activeSessions.ip = ip;
      user.activeSessions.os = os;

      await user.save();
    } else {
      user.activeSessions.refreshTokens =
        user.activeSessions.refreshTokens?.filter(
          (token) => token === refreshToken
        );

      await user.save();
      throw new Error("Invalid session");
    }
};

// Attach user details (token) to req object
const attachUserToReq = (req, user) => {
  req.user = { _id: user._id, role: user.role };
  return;
};

// Generate new access token using if refresh token is valid
const handleTokenRefresh = async ({ req, res, refreshToken }) => {
  console.log("token refresh(new access token)");
  const refreshTokenPayload = verify_token({
    token: refreshToken,
    type: "refresh",
  });
  const userId = refreshTokenPayload.user._id;
  const existingUser = await getExistingUser(userId);

  const ua = getDeviceData(req);
  // Validate session
  await validateSession({
    user: existingUser,
    ip: req.ip,
    os: ua.os.name,
    refreshToken,
    browser: ua.browser.name,
  });

  // Create new access token
  const tokenPayload = getTokenPayload(existingUser);
  const newAccessToken = createAccessToken(tokenPayload);
  attachAccessTokenToCookies({ res, accessToken: newAccessToken });
  attachUserToReq(req, existingUser);
  console.log("token refresh complete");

  return;
};

// Authentication middleware
exports.auth = async (req, res, next) => {
  console.log("Authentication middleware");
  const { accessToken, refreshToken } = req.signedCookies;

  try {
    if (!accessToken) {
      console.log("NO access token");
      throw new UnauthenticatedError("Session expired, please login again");
    }

    const accessTokenpayload = verify_token({
      token: accessToken,
      type: "access",
    });

    const userId = accessTokenpayload.user._id;
    const existingUser = await getExistingUser(userId);

    attachUserToReq(req, existingUser);

    if (existingUser.role === "user") {
      if (!refreshToken) {
        console.log("No existing refresh token");

        throw new UnauthenticatedError("Session expired, please login again");
      }
      const ua = getDeviceData(req);
      // Validate session
      await validateSession({
        user: existingUser,
        ip: req.ip,
        os: ua.os.name,
        refreshToken,
        browser: ua.browser.name,
      });
    }

    return next();
  } catch (accessError) {
    console.log("!!! Error in access token: ", accessError.message);

    // Check for refresh token validation
    if (refreshToken) {
      console.log("refresh token exists");
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
      console.log("No refresh token exists");

      // res.clearCookie("accessToken");
      // res.clearCookie("refreshToken");
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

exports.isStaff = async (req, res, next) => {
  const user = await userModel.findById(req.user._id);

  if (!user || user.role !== "staff") {
    throw new UnAuthorizedError("Not authorized to access this route");
  }

  return next();
};
