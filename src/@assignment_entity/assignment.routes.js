const express = require("express");

const {
  addAssignment,
  getSubmoduleAssignments,
  updateAssignment,
  deleteAssignment,
} = require("./assignment.controller");
const { auth, isAdmin } = require("../../middlewares/authentication");

const router = express.Router();

router.route("/").post(auth, isAdmin, addAssignment);

router
  .route("/:id")
  .put(auth, isAdmin, updateAssignment)
  .delete(auth, isAdmin, deleteAssignment);

router.route("/submodule/:submoduleId").get(auth, getSubmoduleAssignments);

module.exports = router;
