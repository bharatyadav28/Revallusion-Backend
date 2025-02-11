const { StatusCodes } = require("http-status-codes");
const multer = require("multer");

const errorMiddleware = (error, req, res, next) => {
  // Logger.error(`Error occurred: ${error.message}\nStack trace: ${error.stack}`);
  console.log("\nError", error);

  const customError = {
    message: error.message || "Internal Server Error",
    statusCode: error.statusCode || 500,
  };

  // Upload error
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      customError.message = "File size is too large";
    }

    if (error.code === "LIMIT_FILE_COUNT") {
      customError.message = "File limit reached";
    }

    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      customError.message = "Unexpected file type";
    }
    customError.statusCode = StatusCodes.BAD_REQUEST;
  }

  //  Mongoose validation errors like any required value not entered.
  if (error.name === "ValidationError") {
    customError.message = Object.values(error.errors)
      .map((item) => item.message)
      .join(",");
    customError.statusCode = StatusCodes.BAD_REQUEST;
  }

  // Email(unique values) entered again
  if (error.code && error.code === 11000) {
    customError.message = `Duplicate value entered for ${Object.keys(
      error.keyValue
    )}`;
    customError.statusCode = StatusCodes.BAD_REQUEST;
  }

  //  format of _id is not correct
  if (error.name === "CastError") {
    customError.message = `No item found with id ${error.value}`;
    customError.statusCode = StatusCodes.NOT_FOUND;
  }

  res.status(customError.statusCode).json({ message: customError.message });
};

module.exports = errorMiddleware;
