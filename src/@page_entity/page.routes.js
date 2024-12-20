// Page routes (Terms_and_conditions, privacy_policy, pricing_policy, refund_policy pages etc.)
const express = require("express");

const {
  addPage,
  getPages,
  deletePage,
  getPage,
  updatePage,
} = require("./page.controller");

const router = express.Router();

router.route("/").post(addPage).get(getPages);
router.route("/:id").delete(deletePage).put(updatePage).get(getPage);

module.exports = router;
