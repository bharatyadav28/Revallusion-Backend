// Plan Routes
const express = require("express");

const {
  addPlan,
  getPlans,
  getPlan,
  updatePlan,
  deletePlan,
} = require("./plan.controller");

const router = express.Router();

router.route("/").post(addPlan).get(getPlans);
router.route("/:id").delete(deletePlan).put(updatePlan).get(getPlan);
module.exports = router;
