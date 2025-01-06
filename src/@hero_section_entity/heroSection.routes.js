// Hero Section Routes
const express = require("express");

const {
  addHeroSection,
  getHeroSection,
  deleteHeroSection,
} = require("./heroSection.controller");
const { auth, isAdmin } = require("../../middlewares/authentication");

const router = express.Router();

router
  .route("/")
  .post(auth, isAdmin, addHeroSection)
  .put(auth, isAdmin, addHeroSection)
  .get(getHeroSection)
  .delete(auth, isAdmin, deleteHeroSection);

module.exports = router;
