const express = require("express");

const {
  addVideosToTutorials,
  updateTutorialVideoSequence,
  deleteVideosFromTutorials,
  getAllLatestTutorials,
} = require("./latest_tutorials.controller");
const { auth, isAdmin } = require("../../middlewares/authentication");

const router = express.Router();

router
  .route("/")
  .post(auth, isAdmin, addVideosToTutorials)
  .get(getAllLatestTutorials);

router
  .route("/:id")
  .put(auth, isAdmin, updateTutorialVideoSequence)
  .delete(auth, isAdmin, deleteVideosFromTutorials);

module.exports = router;
