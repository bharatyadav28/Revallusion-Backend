// Carousal Routes
const express = require("express");

const {
  addFaq,
  getFaqs,
  getFaq,
  updateFaq,
  deleteFaq,
} = require("./faq.controller");
const { auth, isAdmin } = require("../../middlewares/authentication");

const router = express.Router();

router.route("/").post(addFaq).get(auth, isAdmin, getFaqs);
router
  .route("/:id")
  .delete(auth, isAdmin, deleteFaq)
  .put(auth, isAdmin, updateFaq)
  .get(auth, isAdmin, getFaq);

module.exports = router;
