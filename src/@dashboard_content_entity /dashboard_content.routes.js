const express = require("express");

const { auth, isAdmin } = require("../../middlewares/authentication");
const {
  getDashboardContent,
  addSectionName,
  updateSection,
  deleteSection,
  addVideoToSection,
  removeVideoFromSection,
} = require("./dashboard_content.controller");

const router = express.Router();

router.route("/").get(getDashboardContent).post(auth, isAdmin, addSectionName);

router
  .route("/:id")
  .put(auth, isAdmin, updateSection)
  .delete(auth, isAdmin, deleteSection);

router
  .route("/:id/video")
  .put(auth, isAdmin, addVideoToSection)
  .delete(auth, isAdmin, removeVideoFromSection);

module.exports = router;
