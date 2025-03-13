const express = require("express");

const { auth, isAdmin } = require("../../middlewares/authentication");
const {
  adminSignin,
  adminUpdateProfile,
  uploadImage,
  uploadFile,
  staffSignin,
  createStaff,
  getUsers,
  userDetails,
  createUser,
  updateUser,
  deleteUser,
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

router.route("/staff/sign-up").post(auth, isAdmin, createStaff);
router.route("/staff/sign-in").post(staffSignin);

router
  .route("/users")
  .get(auth, isAdmin, getUsers)
  .post(auth, isAdmin, createUser);
router
  .route("/users/:id")
  .get(auth, isAdmin, userDetails)
  .put(auth, isAdmin, updateUser)
  .delete(auth, isAdmin, deleteUser);

module.exports = router;
