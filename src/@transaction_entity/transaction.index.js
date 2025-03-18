const router = require("./transaction.routes.js");
const controller = require("./transaction.controller.js");
const model = require("./transaction.model.js");

module.exports = router;
module.exports.controller = controller;
module.exports.router = router;
module.exports.model = model;
