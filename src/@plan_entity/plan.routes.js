// Plan Routes
const express = require("express");

const {
  addPlan,
  getPlans,
  getPlan,
  updatePlan,
  deletePlan,
} = require("./plan.controller");
const { auth, isAdmin } = require("../../middlewares/authentication");

const router = express.Router();

router.route("/").post(auth, isAdmin, addPlan).get(getPlans);
router
  .route("/:id")
  .delete(auth, isAdmin, deletePlan)
  .put(auth, isAdmin, updatePlan)
  .get(getPlan);
module.exports = router;
