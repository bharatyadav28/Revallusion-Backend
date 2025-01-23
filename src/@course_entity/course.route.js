// Plan Routes
const express = require("express");

const {
  addCourse,
  updateCourse,
  getCourses,
  getCourse,
  addSubModule,
  updateSubModule,
  addModule,
} = require("./course.controller");
const { auth, isAdmin } = require("../../middlewares/authentication");

const router = express.Router();

router.route("/").post(auth, isAdmin, addCourse).get(getCourses);
router.route("/:id").put(auth, isAdmin, updateCourse).get(getCourse);

router.route("/module").post(addModule);

router.route("/submodule").post(addSubModule);
router.route("/submodule/:id").put(updateSubModule);

module.exports = router;
