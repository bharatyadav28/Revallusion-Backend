const express = require("express");

const { auth, isAdmin } = require("../../middlewares/authentication");
const {
  getAllTransactions,
  getFilteredTransactions,
} = require("./transaction.controller");

const router = express.Router();

router.route("/").get(auth, isAdmin, getAllTransactions);
router.route("/filtered").get(auth, isAdmin, getFilteredTransactions);

module.exports = router;
