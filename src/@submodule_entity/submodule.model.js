const mongoose = require("mongoose");

const SubmoduleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please enter sub-module name"],
    trim: true,
  },
  module: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Module",
    required: true,
  },
  thumbnailUrl: String,
  sequence: {
    type: Number,
    required: [true, "Please enter sub-module sequence"],
  },
});
SubmoduleSchema.index({ module: 1, sequence: 1 }, { unique: true });

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
