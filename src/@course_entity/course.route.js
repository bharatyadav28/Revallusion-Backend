// Plan Routes
const express = require("express");

const {
  addCourse,
  updateCourse,
  getCourses,
  getCourse,
  getCoursesNames,
  updateVideoSequence,
  getSubscribedPlanCourse,
  getCourseTitle,
} = require("./course.controller");
const { auth, isAdmin } = require("../../middlewares/authentication");

const router = express.Router();

router.route("/").post(auth, isAdmin, addCourse).get(auth, isAdmin, getCourses);
router.route("/names").get(auth, isAdmin, getCoursesNames);

router
  .route("/getSubscribedPlanCourse/:planId")
  .get(auth, getSubscribedPlanCourse);
router
  .route("/:id")
  .put(auth, isAdmin, updateCourse)
  .get(auth, isAdmin, getCourse);

router.route("/:id/title").get(auth, isAdmin, getCourseTitle);

router.route("/video-sequence/:id").put(auth, isAdmin, updateVideoSequence);

module.exports = router;
