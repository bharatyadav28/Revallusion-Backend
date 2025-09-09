const express = require("express");

const { auth, isAdmin } = require("../../middlewares/authentication");
const {
  submitAssignment,
  updateScore,
  getSubmittedAssignments,
  revokeAssignment,
  uploadAssignmentAnswer,
  hasAlreadySubmittedAssignment,
  subscribedCourseAssignments,
  getUserAssignments,
  updateScoreByAI,
} = require("./submitted_assignment.controller");
const { upload } = require("../../utils/s3");

const router = express.Router();

router
  .route("/")
  .post(auth, submitAssignment)
  .get(auth, isAdmin, getSubmittedAssignments);

router
  .route("/upload-answer")
  .post(auth, upload.single("file"), uploadAssignmentAnswer);
router.route("/:id").put(auth, isAdmin, updateScore);
router.route("/ai/:id").put(auth, isAdmin, updateScoreByAI);
router.route("/:id/revoke").put(auth, isAdmin, revokeAssignment);

router
  .route("/already-submitted/video/:videoId")
  .get(auth, hasAlreadySubmittedAssignment);

router
  .route("/subscribed-course-assignments")
  .get(auth, subscribedCourseAssignments);

router.route("/user/:id").get(getUserAssignments);

module.exports = router;
