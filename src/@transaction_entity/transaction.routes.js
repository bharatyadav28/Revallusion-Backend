const express = require("express");

const { auth, isAdmin } = require("../../middlewares/authentication");
const {
  getAllTransactions,
  getFilteredTransactions,
  getUserTransactions,
  downloadAsCsv,
} = require("./transaction.controller");

const router = express.Router();

router.route("/").get(auth, isAdmin, getAllTransactions);
router.route("/user/:id").get(auth, isAdmin, getUserTransactions);
router.route("/filtered").get(auth, isAdmin, getFilteredTransactions);
router.route("/export").get(auth, isAdmin, downloadAsCsv);

module.exports = router;
