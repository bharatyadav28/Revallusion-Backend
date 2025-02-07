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
} = require("./course.controller");
const { auth, isAdmin } = require("../../middlewares/authentication");

const router = express.Router();

router.route("/").post(auth, isAdmin, addCourse).get(getCourses);
router.route("/names").get(getCoursesNames);

router
  .route("/getSubscribedPlanCourse/:planId")
  .get(auth, getSubscribedPlanCourse);
router.route("/:id").put(auth, isAdmin, updateCourse).get(getCourse);

router.route("/video-sequence/:id").put(updateVideoSequence);

module.exports = router;
