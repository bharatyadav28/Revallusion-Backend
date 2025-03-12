const express = require("express");

const { auth } = require("../../middlewares/authentication");
const {
  signin,
  logout,
  verifyUser,
  switchDevice,
  googleAuth,
  sendMe,
  updateAvatar,
  updateMobile,
  updateName,
  deleteAccount,
} = require("./user.controller");
const { upload } = require("../../utils/s3");

const router = express.Router();

router.route("/signin").post(signin);
router.route("/verify-user").post(verifyUser);
router.route("/switch-device").post(switchDevice);

router.route("/google-auth").post(googleAuth);

router.route("/send-me").get(auth, sendMe);
router.route("/logout").delete(auth, logout);

router.route("/avatar").put(auth, upload.single("file"), updateAvatar);
router.route("/name").put(auth, updateName);
router.route("/mobile").put(auth, updateMobile);

router.route("/delete-account").delete(auth, deleteAccount);

module.exports = router;
