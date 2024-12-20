// Carousal Routes
const express = require("express");

const {
  addCarousalData,
  getCarousals,
  getCarousal,
  deleteCarousal,
  updateCarousal,
} = require("./carousal.controller");

const router = express.Router();

router.route("/").post(addCarousalData).get(getCarousals);
router
  .route("/:id")
  .delete(deleteCarousal)
  .put(updateCarousal)
  .get(getCarousal);

module.exports = router;
