const express = require("express");

const { auth, isAdmin } = require("../../middlewares/authentication");
const {
  getDashboardContent,
  addSectionName,
  updateSection,
  deleteSection,
} = require("./dashboard_content.controller");

const router = express.Router();

router.route("/").get(getDashboardContent).post(auth, isAdmin, addSectionName);

router
  .route("/:id")
  .put(auth, isAdmin, updateSection)
  .delete(auth, isAdmin, deleteSection);

module.exports = router;
