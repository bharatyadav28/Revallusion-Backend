const express = require("express");

const {
  addTimeStamp,
  updateTimeStamp,
  getTimeStamps,
  deleteTimestamp,
} = require("./timestamp.controller");
const { auth, isAdmin } = require("../../middlewares/authentication");

const router = express.Router();

router
  .route("/video/:id")
  .post(auth, isAdmin, addTimeStamp)
  .get(auth, isAdmin, getTimeStamps);
router
  .route("/:id")
  .put(auth, isAdmin, updateTimeStamp)
  .delete(auth, isAdmin, deleteTimestamp);

module.exports = router;
