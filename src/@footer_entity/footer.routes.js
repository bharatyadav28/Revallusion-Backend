// Footer Routes
const express = require("express");

const {
  createFooter,
  getFooters,
  getFooterById,
  updateFooter,
  deleteFooter,
} = require("./footer.controller");
const { auth, isAdmin } = require("../../middlewares/authentication");

const router = express.Router();

// Public routes
router.route("/").get(getFooters);
router.route("/:id").get(getFooterById);

// Admin only routes
router.route("/").post(auth, isAdmin, createFooter);
router
  .route("/:id")
  .put(auth, isAdmin, updateFooter)
  .delete(auth, isAdmin, deleteFooter);

module.exports = router;
