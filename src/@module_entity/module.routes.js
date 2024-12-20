// Mentor Routes
const express = require("express");

const {
  createModule,
  getModules,
  getModule,
  updateModule,
  deleteModule,
} = require("./module.controller");

const router = express.Router();

router.route("/").post(createModule).get(getModules);
router.route("/:id").get(getModule).put(updateModule).delete(deleteModule);

module.exports = router;
