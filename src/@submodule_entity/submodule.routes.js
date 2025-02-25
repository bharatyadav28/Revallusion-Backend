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

module.exports = router;
