const router = require("./user.routes.js");
const controller = require("./user.controller.js");
const model = require("./user.model.js");

module.exports = router;
module.exports.controller = controller;
module.exports.router = router;
module.exports.model = model;
