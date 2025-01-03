const jwt = require("jsonwebtoken");

const minTime = 1000 * 60 * 60 * 24;
// const minTime = 1000 * 10;

const maxTime = 1000 * 60 * 60 * 24 * 7;
// const maxTime = 1000 * 10;

const tempTime = 1000 * 60 * 5; //  5 min

// Create tokens
exports.createAccessToken = (payload) => {
  const token = jwt.sign(payload, process.env.ACCESS_SECRET, {
    expiresIn: minTime / 1000,
  });

  return token;
};

exports.createRefreshToken = (payload, keepMeSignedIn) => {
  const tokenExpiry = keepMeSignedIn ? maxTime : minTime;
  const token = jwt.sign(payload, process.env.REFRESH_SECRET, {
    expiresIn: tokenExpiry / 1000,
  });
  return token;
};

exports.createTempToken = (payload) => {
  const token = jwt.sign(payload, process.env.TEMP_SECRET, {
    expiresIn: tempTime / 1000,
  });
  return token;
};

// Verify tokens
exports.verify_token = ({ token, type }) => {
  let secret = process.env.ACCESS_SECRET;
  if (type === "refresh") {
    secret = process.env.REFRESH_SECRET;
  } else if (type === "temp") {
    secret = process.env.TEMP_SECRET;
  }
  return jwt.verify(token, secret);
};

// Add access and refresh token to cookies
exports.attachCookiesToResponse = ({
  res,
  accessToken,
  refreshToken,
  keepMeSignedIn,
}) => {
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: new Date(Date.now() + minTime),
    signed: true,
  });
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: new Date(Date.now() + (keepMeSignedIn ? maxTime : minTime)),
    signed: true,
  });
};

// Add access token to cookies(incase access token is invalid but refresh token is valid )
exports.attachAccessTokenToCookies = ({ res, accessToken }) => {
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: new Date(Date.now() + minTime),
    signed: true,
  });
};

// Cookie for a temporary token
exports.attachTempTokenToCookies = ({ res, tempToken }) => {
  res.cookie("tempToken", tempToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: new Date(Date.now() + tempTime),
    signed: true,
  });
};
