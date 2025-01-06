// Carousal Routes
const express = require("express");

const {
  addCarousalData,
  getCarousals,
  getCarousal,
  deleteCarousal,
  updateCarousal,
} = require("./carousal.controller");
const { auth, isAdmin } = require("../../middlewares/authentication");

const router = express.Router();

router.route("/").post(auth, isAdmin, addCarousalData).get(getCarousals);
router
  .route("/:id")
  .delete(auth, isAdmin, deleteCarousal)
  .put(auth, isAdmin, updateCarousal)
  .get(getCarousal);

module.exports = router;
