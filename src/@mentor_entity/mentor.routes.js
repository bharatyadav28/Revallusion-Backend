// Mentor Routes
const express = require("express");

const {
  addMentor,
  getMentorsData,
  deleteMentorsData,
} = require("./mentor.controller");
const { auth, isAdmin } = require("../../middlewares/authentication");

const router = express.Router();

router
  .route("/")
  .post(auth, isAdmin, addMentor)
  .put(auth, isAdmin, addMentor)
  .get(getMentorsData)
  .delete(auth, isAdmin, deleteMentorsData);

module.exports = router;
