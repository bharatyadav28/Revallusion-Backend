const mongoose = require("mongoose");

const ModuleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please enter module name"],
    trim: true,
    unique: [true, "Module name must be unique"],
  },
  description: {
    type: String,
    required: [true, "Please enter module description"],
    trim: true,
  },
  key_points: {
    type: [String],
    required: [true, "Please enter module key points"],
  },
});

const ModuleModel = mongoose.model("Module", ModuleSchema);
module.exports = ModuleModel;
