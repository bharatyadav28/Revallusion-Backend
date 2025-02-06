const mongoose = require("mongoose");

const BookmarkSchema = new mongoose.Schema({
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
});

const BookmarkModel = mongoose.model("Bookmark", BookmarkSchema);

module.exports = BookmarkModel;
