const express = require("express");

const { auth } = require("../../middlewares/authentication");
const {
  signin,
  logout,
  verifyUser,
  switchDevice,
  googleAuth,
  sendMe,
  getHomeContent,
} = require("./user.controller");

const router = express.Router();

router.route("/home").get(getHomeContent);

router.route("/signin").post(signin);
router.route("/verify-user").post(verifyUser);
router.route("/switch-device").post(switchDevice);

router.route("/google-auth").post(googleAuth);

router.route("/send-me").get(auth, sendMe);
router.route("/logout").delete(auth, logout);

module.exports = router;
