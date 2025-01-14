const router = require("./video.routes.js");
const controller = require("./video.controller.js");
const model = require("./video.model.js");

module.exports = router;
module.exports.controller = controller;
module.exports.router = router;
module.exports.model = model;
