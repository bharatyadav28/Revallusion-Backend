const express = require("express");

const { auth, isAdmin } = require("../../middlewares/authentication");
const {
  adminSignin,
  adminUpdateProfile,
  uploadImage,
  uploadFile,
} = require("./admin.controller");
const { upload } = require("../../utils/s3");
const { sendMe } = require("../@user_entity/user.controller");

const router = express.Router();

router.route("/signin").post(adminSignin);

router.route("/update-profile").put(auth, isAdmin, adminUpdateProfile);

router.route("/send-me").get(auth, isAdmin, sendMe);

router
  .route("/upload-image")
  .post(auth, isAdmin, upload.single("file"), uploadImage);

router
  .route("/upload-file")
  .post(auth, isAdmin, upload.single("file"), uploadFile);

module.exports = router;
