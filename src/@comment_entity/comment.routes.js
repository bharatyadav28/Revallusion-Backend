const express = require("express");

const {
  getVideoComments,
  createComment,
  deleteComment,
  getAllComments,
  replyComment,
} = require("./comment.controller");
const { auth, isAdmin } = require("../../middlewares/authentication");

const router = express.Router();

router.route("/video/:videoId").get(getVideoComments).post(auth, createComment);

router.route("/:id").delete(auth, isAdmin, deleteComment);

router.route("/:id/reply").put(auth, isAdmin, replyComment);

router.route("/").get(auth, isAdmin, getAllComments);

module.exports = router;
