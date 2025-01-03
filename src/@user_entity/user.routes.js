const express = require("express");

const { auth } = require("../../middlewares/authentication");

const {
  signin,
  logout,
  verifyUser,
  switchDevice,
  googleAuth,
} = require("./user.controller");

const router = express.Router();

router.route("/signin").post(signin);
router.route("/verify-user").post(verifyUser);
router.route("/switch-device").post(switchDevice);

router.route("/google-auth").post(googleAuth);
router.route("/logout").delete(auth, logout);

module.exports = router;
