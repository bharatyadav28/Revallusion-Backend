const UAParser = require("ua-parser-js");
const { v4: uuidv4 } = require("uuid");

const userModel = require("../src/@user_entity/user.model");
const { NotFoundError } = require("../errors/index");
const mongoose = require("mongoose");

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
  return url.replace(/^https?:\/\/[^/]+\/([^?]+)(\?.*)?$/, "$1");
};
exports.extractVideoURLKey = (url) => {
  const fileName = url.split("/").pop();
  return fileName.replace(/\.[^/.]+$/, "");
};

exports.awsUrl = `https://dcays3srybill.cloudfront.net`;

// Append AWS bucket name before the file path
exports.appendBucketName = (url) => {
  return `${exports.awsUrl}/${url}`;
};

exports.appendVideoCDN = (url) => {
  const videoUUID = url.split("/")[1];
  return `${exports.awsUrl}/${videoUUID}/1080pvideo_00001.ts`;
};

exports.StringToObjectId = (str) => {
  return new mongoose.Types.ObjectId(str);
};

exports.clearCookies = ({ res }) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
};

// Update sequence of item in an array
exports.updateSequence = ({
  arr,
  currentSequence,
  latestSequence,
  newSequence,
}) => {
  let sequence = newSequence;
  if (sequence > latestSequence) sequence = latestSequence;

  if (sequence < currentSequence) {
    // If new sequence is less than current sequence, increment required videos sequences
    arr.forEach((item) => {
      if (item.sequence >= sequence && item.sequence < currentSequence) {
        item.sequence += 1;
      }
    });
  } else {
    // If new sequence is greater than current sequence, decrement required submodule sequences
    arr.forEach((item) => {
      if (item.sequence <= sequence && item.sequence > currentSequence) {
        item.sequence -= 1;
      }
    });
  }

  return sequence;
};

exports.getFrontendDomain = (req) => {
  // Try X-Forwarded-Host first, fall back to Host header
  const host = req.get("X-Forwarded-Host") || req.get("host");
  const protocol = req.get("X-Forwarded-Proto") || req.protocol;

  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    return "http://localhost:3000"; // Development frontend URL
  }

  return `${protocol}://${host}`;
};

exports.isoToReadable = (iso) => {
  if (!iso) {
    return null;
  }
  const d = new Date(iso);
  const month = d.getMonth() + 1; // Month is zero-indexed
  const day = d.getDate();
  const year = d.getFullYear();

  return `${day < 10 ? "0" + day : day}/${
    month < 10 ? "0" + month : month
  }/${year}`;
};

exports.numberToWords = (number) => {
  // Check for invalid input
  if (number < 1 || number > 9999) {
    throw new Error("Number must be between 1 and 9999");
  }

  // Define arrays for ones, tens, and teens
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const teens = [
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  // Separate thousands, hundreds, tens, and ones digits
  const thousands = Math.floor(number / 1000);
  const hundreds = Math.floor((number % 1000) / 100);
  const tensDigit = Math.floor((number % 100) / 10);
  const onesDigit = number % 10;

  // Build the word representation
  let words = "";

  // Add thousands part
  if (thousands > 0) {
    words += exports.numberToWords(thousands) + " Thousand ";
  }

  // Add hundreds part
  if (hundreds > 0) {
    words += ones[hundreds] + " Hundred ";
  }

  // Add tens and ones parts
  if (tensDigit > 0) {
    if (tensDigit === 1 && onesDigit > 0) {
      words += teens[onesDigit - 1];
    } else {
      words += tens[tensDigit];
      if (onesDigit > 0) {
        words += " " + ones[onesDigit];
      }
    }
  } else if (onesDigit > 0) {
    words += ones[onesDigit];
  }

  // Remove trailing space
  words = words.trim();

  return words;
};

exports.formatDateTime = (dateTimeString, year_only) => {
  const dateTime = new Date(dateTimeString.getTime() + 19800000);
  const month = dateTime.toLocaleString("default", { month: "short" });
  const day = dateTime.getDate();
  let year = dateTime.getFullYear();
  year = "" + year + "";
  const monthNumber = dateTime.getMonth();
  // if (monthNumber < 3) {
  //   year = year - 1 + " - " + year;
  // } else {
  //   year = year + " - " + (year + 1);
  // }
  const time = dateTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });
  if (year_only) return year;
  return `${day} ${month}, ${year}`;
};

exports.generateUniqueId = () => {
  const uuid = uuidv4();
  return uuid;
};
