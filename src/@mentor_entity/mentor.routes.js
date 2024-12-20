// Mentor Routes
const express = require("express");

const {
  addMentor,
  getMentorsData,
  deleteMentorsData,
} = require("./mentor.controller");

const router = express.Router();

router
  .route("/")
  .post(addMentor)
  .put(addMentor)
  .get(getMentorsData)
  .delete(deleteMentorsData);

module.exports = router;
