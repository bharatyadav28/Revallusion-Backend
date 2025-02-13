const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Please provide user id"],
    },
    video: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Video",
      required: [true, "Please provide video id"],
    },
    comment: {
      type: String,
      required: [true, "Please provide comment"],
      trim: true,
    },
    reply: {
      type: String,
      trim: true,
      required: [true, "Please provide reply"],
    },
    repliedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const CommentModel = mongoose.model("Comment", CommentSchema);

module.exports = CommentModel;
