const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcrypt");

const activeSessionSchema = new mongoose.Schema({
  refreshToken: {
    type: String,
    trim: true,
    required: [true, "Please provide refresh token"],
  },
  deviceInfo: {
    deviceId: {
      type: String,
      trim: true,
      required: [true, "Please provide device Id"],
    },
    userAgent: {
      type: String,
      trim: true,
      required: [true, "Please provide user agent"],
    },
    browser: {
      type: String,
      trim: true,
      required: [true, "Please provide browser name"],
    },
    os: {
      type: String,
      trim: true,
      required: [true, "Please provide os name"],
    },
    lastUsed: {
      type: Date,
      default: Date.now(),
    },
  },
});

// User Schema
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
      trim: true,
      // default: "https://cdn-icons-png.flaticon.com/512/5556/5556499.png",
    },

    email: {
      type: String,
      trim: true,
      validate: validator.isEmail,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    mobile: {
      type: String,
      // trim: true,
      validate: {
        validator: function (v) {
          return validator.isMobilePhone(v, "any", { strictMode: true });
        },
        message: (props) => `${props.value} is not a valid phone number!`,
      },
    },

    isMobileVerified: {
      type: Boolean,
      default: false,
    },

    password: {
      type: String,
      // required: [true, "Please enter your password"],
      trim: true,
      minLength: [8, "Password must be at least 8 characters long"],
      select: false,
    },

    role: {
      type: String,
      enum: ["user", "admin", "staff"],
      default: "user",
    },

    activeSessions: [activeSessionSchema],

    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Pre save hook
userSchema.pre("save", async function (next) {
  // avoid hashing when other fields except password are updated
  if (!this.isModified("password")) {
    return next();
  }

  const salt = await bcrypt.genSalt(Number(process.env.SALT_ROUNDS));
  this.password = await bcrypt.hash(this.password, salt);
  return next();
});

//instance methods

// Compare hashed password with entered password
userSchema.methods.comparePassword = async function (candidatePassword) {
  const isMatch = await bcrypt.compare(candidatePassword, this.password);
  return isMatch;
};

// User model
const userModel = mongoose.model("User", userSchema);

module.exports = userModel;
