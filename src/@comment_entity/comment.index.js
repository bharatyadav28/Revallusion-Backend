const router = require("./comment.routes.js");
const controller = require("./comment.controller.js");
const model = require("./comment.model.js");

module.exports = router;
module.exports.controller = controller;
module.exports.router = router;
module.exports.model = model;
