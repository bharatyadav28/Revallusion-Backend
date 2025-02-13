const express = require("express");

const { auth, isAdmin } = require("../../middlewares/authentication");
const {
  submitAssignment,
  updateScore,
  getSubmittedAssignments,
  revokeAssignment,
} = require("./submitted_assignment.controller");

const router = express.Router();

router.route("/").post(auth, submitAssignment);
router.route("/:id").put(auth, isAdmin, updateScore);
router.route("/:id/revoke").put(revokeAssignment);

router.route("/course/:id").get(auth, isAdmin, getSubmittedAssignments);

module.exports = router;
