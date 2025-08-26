const express = require("express");

const { auth, isAdmin } = require("../../middlewares/authentication");
const {
  createDashboardCarousal,
  getDashboardCarousals,
  deleteDashboardCarousal,
  updateDashboardCarousal,
  updateDashboardSideImages,
} = require("./dashboard_carousal.controller");

const router = express.Router();

router
  .route("/")
  .post(auth, isAdmin, createDashboardCarousal)
  .get(getDashboardCarousals);

router
  .route("/:id")
  .put(auth, isAdmin, updateDashboardCarousal)
  .delete(auth, isAdmin, deleteDashboardCarousal);

router.route("/side/images").put(auth, isAdmin, updateDashboardSideImages);

module.exports = router;
