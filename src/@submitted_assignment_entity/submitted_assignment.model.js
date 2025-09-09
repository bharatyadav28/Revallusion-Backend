const mongoose = require("mongoose");
const { trim } = require("validator");

const SubmittedAssignmentSchema = new mongoose.Schema({
  video: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Video",
    required: [true, "Please provide video id"],
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "Please provide user id"],
  },
  submittedFileUrl: {
    type: String,
    trim: true,
    required: true,
  },
  score: {
    type: Number,
    min: 0,
    max: 100,
    default: null,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  gradedAt: {
    type: Date,
    default: null,
  },
  isGradedByAdmin: {
    type: Boolean,
    default: false,
  },
  feedback: {
    type: String,
    trim: true,
    default: null,
  },
  isRevoked: {
    type: Boolean,
    default: false,
  },
  revokedAt: {
    type: Date,
  },
});

SubmittedAssignmentSchema.index({ video: 1, user: 1 });

const SubmittedAssignmentModel = mongoose.model(
  "SubmittedAssignment",
  SubmittedAssignmentSchema
);

module.exports = SubmittedAssignmentModel;
