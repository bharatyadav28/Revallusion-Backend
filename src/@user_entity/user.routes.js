// Query Routes (contact us)
const express = require("express");

const { auth } = require("../../middlewares/authentication");

const { signin, logout, verifyUser } = require("./user.controller");

const router = express.Router();

router.route("/signin").post(signin);
router.route("/verify-user").post(verifyUser);
router.route("/logout").delete(auth, logout);

module.exports = router;
