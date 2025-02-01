const router = require("./submodule.routes.js");
const controller = require("./submodule.controller.js");
const model = require("./submodule.model.js");

module.exports = router;
module.exports.controller = controller;
module.exports.router = router;
module.exports.model = model;
