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
  initiateMultipartUpload,
  getUploadParts,
  completeMultipartUpload,
  abortMultipartUpload,
  searchVideos,
  start_upload,
  uploads,
  complete_upload,
} = require("./video.controller.js");
const { upload } = require("../../utils/s3.js");

const router = express.Router();

router.route("/get-upload-url").post(auth, isAdmin, getUploadURL);

router.route("/").get(auth, isAdmin, getVideos).post(auth, isAdmin, saveVideo);

//NOTE: only for Dev purpose
router.route("/delete-all-videos").delete(auth, isAdmin, deleteAllVideos);

router.route("/list").post(auth, isAdmin, getVideoList);

router.route("/introductory-videos").get(getIntroductoryVideos);

router.route("/search").get(auth, searchVideos);

router
  .route("/:id")
  .get(auth, getVideo)
  .delete(auth, isAdmin, deleteVideo)
  .put(auth, isAdmin, updateVideo);

router.route("/active-status/:id").put(auth, isAdmin, updateActiveStatus);

router
  .route("/permanently-delete/:id")
  .delete(auth, isAdmin, permanatelyDeleteVideo);

router.route("/uploads/initiate").post(auth, initiateMultipartUpload);
router.route("/uploads/generate-urls").post(auth, getUploadParts);
router.route("/uploads/complete").post(auth, completeMultipartUpload);
router.route("/uploads/abort").post(auth, abortMultipartUpload);

router.post("/stream/start-upload", auth, isAdmin, start_upload);
router.post("/stream/upload", auth, isAdmin, upload.single("file"), uploads);
router.post("/stream/complete-upload", auth, isAdmin, complete_upload);

module.exports = router;
