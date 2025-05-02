const router = require("./timestamp.routes.js");
const controller = require("./timestamp.controller.js");
const model = require("./timestamp.model.js");

module.exports = router;
module.exports.controller = controller;
module.exports.router = router;
module.exports.model = model;
