const express = require("express");

const {
  addAssignment,
  getSubmoduleAssignments,
} = require("./assignment.controller");
const { auth, isAdmin } = require("../../middlewares/authentication");

const router = express.Router();

router
  .route("/:submodule")
  .post(auth, isAdmin, addAssignment)
  .get(auth, getSubmoduleAssignments);

router.route("/:submodule");

module.exports = router;
