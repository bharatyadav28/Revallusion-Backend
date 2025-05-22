const express = require("express");

const { auth, isAdmin } = require("../../middlewares/authentication");
const {
  updateVideoProgress,
  getVideoProgress,
  getCourseProgress,
  getCourseVideosProgress,
  yourProgress,
} = require("./video_progress.controller");

const router = express.Router();

router
  .route("/:vid")
  .put(auth, updateVideoProgress)
  .get(auth, getVideoProgress);

router.route("/your/progress").get(auth, yourProgress);

router.route("/course/:cid").get(auth, getCourseProgress);
module.exports = router;
