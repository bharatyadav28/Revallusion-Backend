const mongoose = require("mongoose");

mongoose.set("strictQuery", false);

module.exports = (url) => {
  return mongoose.connect(url);
};
