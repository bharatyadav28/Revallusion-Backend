const mongoose = require("mongoose");

mongoose.set("strictQuery", false);

module.exports = () => {
  mongoose
    .connect(process.env.MONGO_URL)
    .then((data) => {
      console.log(`Database server connected at port: ${data.connection.port}`);
    })
    .catch((e) => console.log(e));
};
