// Mentor Routes
const express = require("express");
const { upload } = require("../../utils/s3");

const {
  addMentor,
  getMentorsData,
  deleteMentorsData,
  getCurriculum,
  updateCurriculum,
} = require("./mentor.controller");
const { auth, isAdmin } = require("../../middlewares/authentication");

const router = express.Router();

router
  .route("/")
  .post(auth, isAdmin, addMentor)
  .put(auth, isAdmin, addMentor)
  .get(getMentorsData)
  .delete(auth, isAdmin, deleteMentorsData);

router
  .route("/curriculum")
  .get(getCurriculum)
  .put(auth, isAdmin, upload.single("file"), updateCurriculum);

module.exports = router;
