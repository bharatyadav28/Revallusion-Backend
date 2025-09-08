const express = require("express");
const { auth, isAdmin } = require("../../middlewares/authentication.js");
const {
  getCourseRecommendations,
  addRecommendedVideos,
  updateRecommendedVideoSequence,
  deleteRecommendedVideo,
  updateActiveStatus,
  getVideoRecommendations,
} = require("./recommended_videos.controller.js");

const recommendedVideosRouter = express.Router();

recommendedVideosRouter
  .route("/course/:courseId")
  .get(auth, isAdmin, getCourseRecommendations)
  .post(auth, isAdmin, addRecommendedVideos);

recommendedVideosRouter
  .route("/public/course/:courseId")
  .get(auth, getVideoRecommendations);

recommendedVideosRouter
  .route("/:id")
  .put(auth, isAdmin, updateRecommendedVideoSequence)
  .delete(auth, isAdmin, deleteRecommendedVideo);

recommendedVideosRouter
  .route("/:id/status")
  .put(auth, isAdmin, updateActiveStatus);

module.exports = recommendedVideosRouter;
