// Hero Section Routes
const express = require("express");

const {
  addHeroSection,
  getHeroSection,
  deleteHeroSection,
} = require("./heroSection.controller");

const router = express.Router();

router
  .route("/")
  .post(addHeroSection)
  .put(addHeroSection)
  .get(getHeroSection)
  .delete(deleteHeroSection);

module.exports = router;
