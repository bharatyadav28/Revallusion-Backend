const mongoose = require("mongoose");

const SubmoduleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please enter topic name"],
    trim: true,
  },
  module: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CourseModule",
    required: true,
  },
  thumbnailUrl: String,
  sequence: {
    type: Number,
    required: [true, "Please enter topic sequence"],
  },
  resource: {
    type: String,
    trim: true,
  },
});
SubmoduleSchema.index({ module: 1, sequence: 1 });

// Static methods

// Get next sequence number in the list
SubmoduleSchema.statics.getNextSequence = async function (moduleId) {
  const maxSequence = await this.findOne(
    { module: moduleId },
    { sequence: 1 },
    { sort: { sequence: -1 } }
  );

  return (maxSequence?.sequence || 0) + 1;
};

const SubmoduleModel = mongoose.model("Submodule", SubmoduleSchema);

module.exports = SubmoduleModel;
