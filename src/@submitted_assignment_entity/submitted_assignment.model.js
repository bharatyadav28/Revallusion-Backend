const mongoose = require("mongoose");

const SubmittedAssignmentSchema = new mongoose.Schema({
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Assignment",
    required: [true, "Please provide assignment id"],
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "Please provide user id"],
  },
  submittedFileUrls: {
    type: [String],
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
});

SubmittedAssignmentSchema.index({ assignmentId: 1, userId: 1 });

const SubmittedAssignmentModel = mongoose.model(
  "SubmittedAssignment",
  SubmittedAssignmentSchema
);

module.exports = SubmittedAssignmentModel;
