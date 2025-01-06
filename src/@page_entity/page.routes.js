// Page routes (Terms_and_conditions, privacy_policy, pricing_policy, refund_policy pages etc.)
const express = require("express");

const {
  addPage,
  getPages,
  deletePage,
  getPage,
  updatePage,
} = require("./page.controller");
const { auth, isAdmin } = require("../../middlewares/authentication");

const router = express.Router();

router.route("/").post(auth, isAdmin, addPage).get(getPages);
router
  .route("/:id")
  .delete(auth, isAdmin, deletePage)
  .put(auth, isAdmin, updatePage)
  .get(getPage);

module.exports = router;
