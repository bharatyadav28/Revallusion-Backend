const mongoose = require("mongoose");
const { trim } = require("validator");

const networkSchema = new mongoose.Schema({
  platform: {
    type: String,
    required: [true, "Please enter platform name"],
    trim: true,
  },
  followers: {
    type: String,
    required: [true, "Please enter followers"],
    trim: true,
  },
});

const MentorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please enter mentor name"],
      trim: true,
    },
    designation: {
      type: String,
      trim: true,
    },
    about: {
      type: String,
      required: [true, "Please enter about text"],
      trim: true,
    },
    networks: [networkSchema],
    curriculum: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const MentorModel = mongoose.model("Mentor", MentorSchema);

module.exports = MentorModel;
