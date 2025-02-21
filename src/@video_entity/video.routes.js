const express = require("express");
const { auth, isAdmin } = require("../../middlewares/authentication");

const {
  getUploadURL,
  saveVideo,
  deleteVideo,
  updateVideo,
  getVideo,
  getVideos,
  permanatelyDeleteVideo,
  deleteAllVideos,
  updateActiveStatus,
  getVideoList,
  getIntroductoryVideos,
} = require("./video.controller.js");

const router = express.Router();

router.route("/get-upload-url").post(auth, isAdmin, getUploadURL);

router.route("/").get(auth, isAdmin, getVideos).post(auth, isAdmin, saveVideo);

//NOTE: only for Dev purpose
router.route("/delete-all-videos").delete(auth, isAdmin, deleteAllVideos);

router.route("/list").post(auth, isAdmin, getVideoList);

router.route("/introductory-videos").get(getIntroductoryVideos);

router
  .route("/:id")
  .get(auth, getVideo)
  .delete(auth, isAdmin, deleteVideo)
  .put(auth, isAdmin, updateVideo);

router.route("/active-status/:id").put(auth, isAdmin, updateActiveStatus);

router
  .route("/permanently-delete/:id")
  .delete(auth, isAdmin, permanatelyDeleteVideo);

module.exports = router;
