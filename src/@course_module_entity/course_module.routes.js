const express = require("express");

const { auth, isAdmin } = require("../../middlewares/authentication");
const {
  addModule,
  updateModuleName,
  deleteModule,
} = require("./course_module.controller");

const router = express.Router();

router.route("/").post(auth, isAdmin, addModule);
router
  .route("/:id")
  .put(auth, isAdmin, updateModuleName)
  .delete(auth, isAdmin, deleteModule);

module.exports = router;
