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
} = require("./video.controller.js");

const router = express.Router();

router.route("/get-upload-url").post(auth, isAdmin, getUploadURL);

router.route("/").get(getVideos).post(saveVideo);

//NOTE: only for Dev purpose
router.route("/delete-all-videos").delete(auth, isAdmin, deleteAllVideos);

router
  .route("/:id")
  .get(getVideo)
  .delete(auth, isAdmin, deleteVideo)
  .put(auth, isAdmin, updateVideo);

router.route("/active-status/:id").put(auth, isAdmin, updateActiveStatus);

router
  .route("/permanently-delete/:id")
  .delete(auth, isAdmin, permanatelyDeleteVideo);

module.exports = router;
