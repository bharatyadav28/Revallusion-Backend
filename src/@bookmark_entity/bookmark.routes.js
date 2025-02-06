const express = require("express");
const {
  addBookMark,
  getAllBookMarks,
  deleteBookMark,
} = require("./bookmark.controller");
const { auth } = require("../../middlewares/authentication");

const router = express.Router();

router.route("/").post(auth, addBookMark).get(auth, getAllBookMarks);

router.route("/:id").delete(deleteBookMark);

module.exports = router;
