const StatusCodes = require("http-status-codes");
const CustomError = require("./custom-errors");

class ConflictError extends CustomError {
  constructor(message) {
    super(message);
    this.statusCode = StatusCodes.CONFLICT;
  }
}

module.exports = ConflictError;
