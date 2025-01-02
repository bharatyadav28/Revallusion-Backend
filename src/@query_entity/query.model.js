const mongoose = require("mongoose");
const validator = require("validator");

const QuerySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please enter your name"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please enter your email"],
      validate: [validator.isEmail, "Please enter valid email address"],
      trim: true,
    },
    mobile: {
      type: String,
      required: [true, "Please enter your phone number"],
      validator: validator.isMobilePhone,
    },
    profession: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    message: {
      type: String,
      required: [true, "Please enter your message/query"],
      trim: true,
    },
    file: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const QueryModel = mongoose.model("Query", QuerySchema);

module.exports = QueryModel;
