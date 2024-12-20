// Carousal Routes
const express = require("express");

const {
  addFaq,
  getFaqs,
  getFaq,
  updateFaq,
  deleteFaq,
} = require("./faq.controller");

const router = express.Router();

router.route("/").post(addFaq).get(getFaqs);
router.route("/:id").delete(deleteFaq).put(updateFaq).get(getFaq);

module.exports = router;
