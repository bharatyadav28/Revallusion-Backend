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
  getCoursesNames,
  updateModuleName,
  updateVideoSequence,
} = require("./course.controller");
const { auth, isAdmin } = require("../../middlewares/authentication");

const router = express.Router();

router.route("/").post(auth, isAdmin, addCourse).get(getCourses);
router.route("/names").get(getCoursesNames);
router.route("/:id").put(auth, isAdmin, updateCourse).get(getCourse);

router.route("/module").post(addModule);
router.route("/module/:id").put(updateModuleName);

router.route("/submodule").post(addSubModule);
router.route("/submodule/:id").put(updateSubModule);

router.route("/video-sequence/:id").put(updateVideoSequence);

module.exports = router;
