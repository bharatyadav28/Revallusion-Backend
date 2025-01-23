const mongoose = require("mongoose");
const { StringToObjectId } = require("../../utils/helperFuns.js");

// Schema for Video in course
const CourseVideoSchema = new mongoose.Schema(
  {
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "video",
      required: [true, "Please provide video id"],
    },
    sequence: {
      type: Number,
      required: [true, "Please enter video sequence"],
      unique: [true, "Video sequence should be unique"],
    },
  },
  {
    _id: false,
  }
);
// CourseVideoSchema.index({ sequence: 1 });

// Schema for each submodule in a module
const SubmodulesSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please enter sub-module name"],
    trim: true,
  },
  videos: [CourseVideoSchema],
  sequence: {
    type: Number,
    required: [true, "Please enter sub-module sequence"],
    unique: [true, "Sub-module sequence should be unique"],
  },
});
// SubmodulesSchema.index({ sequence: 1 });

// Schema for each module in a course
const ModulesSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please enter module name"],
    trim: true,
  },

  subModules: [SubmodulesSchema],
});

// Main course table Schema
const CourseSchema = new mongoose.Schema(
  {
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
    },
    title: {
      type: String,
      required: [true, "Please provide course title"],
      trim: true,
    },
    modules: [ModulesSchema],
    freeVideos: [CourseVideoSchema],
    isFree: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Static methods
CourseSchema.statics.getLatestSequenceNumber = function (arr) {
  let latestSequence = 0;

  // Find current largest sequence among submodules
  if (arr.length > 0) {
    latestSequence = arr.reduce((acc, item) => {
      const currentSequence = item.sequence;

      if (currentSequence > acc) {
        return currentSequence;
      }
      return acc;
    }, arr[0].sequence);
  }

  return latestSequence;
};

CourseSchema.statics.removeItemSequence = function ({
  arr,
  toRemoveItem,
  isVideo = false,
  makeInactive = false,
}) {
  let removeableIndex = -1;
  let currentSequence = toRemoveItem.sequence;

  arr.forEach((item, index) => {
    const itemId = !isVideo ? item._id : item.videoId;
    const toRemoveItemId = !isVideo ? toRemoveItem._id : toRemoveItem.videoId;

    if (itemId.equals(toRemoveItemId)) {
      if (isVideo && makeInactive) {
        item.sequence = -1;
      } else {
        // Remove the item from the original array by splicing
        removeableIndex = index;
      }
    } else if (item.sequence > currentSequence) {
      // Adjust sequence for items with higher sequence values
      item.sequence -= 1;
    }
  });

  if (removeableIndex >= 0) arr.splice(removeableIndex, 1);
};

// CourseSchema.index({ "modules.subModules.sequence": 1 });
const CourseModel = mongoose.model("Course", CourseSchema);

module.exports = CourseModel;
