const express = require("express");

const { auth, isAdmin } = require("../../middlewares/authentication");
const {
  submitAssignment,
  updateScore,
  getSubmittedAssignments,
  revokeAssignment,
  uploadAssignmentAnswer,
  hasAlreadySubmittedAssignment,
} = require("./submitted_assignment.controller");
const { upload } = require("../../utils/s3");

const router = express.Router();

router.route("/").post(auth, submitAssignment);

router
  .route("/upload-answer")
  .post(auth, upload.single("file"), uploadAssignmentAnswer);
router.route("/:id").put(auth, isAdmin, updateScore);
router.route("/:id/revoke").put(auth, isAdmin, revokeAssignment);

router.route("/course/:id").get(auth, isAdmin, getSubmittedAssignments);

router
  .route("/already-submitted/video/:videoId")
  .get(auth, hasAlreadySubmittedAssignment);

module.exports = router;
