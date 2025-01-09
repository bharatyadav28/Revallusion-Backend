const express = require("express");

const { auth, isAdmin } = require("../../middlewares/authentication");
const {
  adminSignin,
  adminUpdateProfile,
  uploadImage,
} = require("./admin.controller");
const { upload } = require("../../utils/s3");

const router = express.Router();

router.route("/signin").post(adminSignin);

router.route("/update-profile").put(auth, isAdmin, adminUpdateProfile);

router
  .route("/upload-image")
  .post(auth, isAdmin, upload.single("file"), uploadImage);

module.exports = router;
