const express = require("express");

const { addTimeStamp, updateTimeStamp } = require("./timestamp.controller");
const { auth, isAdmin } = require("../../middlewares/authentication");

const router = express.Router();

router.route("/video/:id").post(auth, isAdmin, addTimeStamp);
router.route("/:id").put(auth, isAdmin, updateTimeStamp);

module.exports = router;
