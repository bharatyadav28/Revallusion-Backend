const router = require("./order.routes.js");
const controller = require("./order.controller.js");
const model = require("./order.model.js");

module.exports = router;
module.exports.controller = controller;
module.exports.router = router;
module.exports.model = model;
