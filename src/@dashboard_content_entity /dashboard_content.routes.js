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

router.route("/:id").put(updateSection).delete(deleteSection);

module.exports = router;
