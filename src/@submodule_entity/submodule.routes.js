const express = require("express");

const { auth, isAdmin } = require("../../middlewares/authentication");
const {
  addSubModule,
  updateSubModule,
  addResource,
  deleteResource,
  getResources,
} = require("./submodule.controller");
const { upload } = require("../../utils/s3");

const router = express.Router();

router.route("/").post(auth, isAdmin, addSubModule);
router.route("/:id").put(auth, isAdmin, updateSubModule);

router
  .route("/:id/resource")
  .get(getResources)
  .post(auth, isAdmin, upload.array("file"), addResource);

router.route("/:id/resource/:rid").delete(auth, isAdmin, deleteResource);

module.exports = router;
