const express = require("express");

const { auth, isAdmin } = require("../../middlewares/authentication");
const {
  createDashboardCarousal,
  getDashboardCarousals,
  deleteDashboardCarousal,
  updateDashboardCarousal,
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
module.exports = router;
