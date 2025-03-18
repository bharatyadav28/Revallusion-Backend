const express = require("express");

const { auth, isAdmin } = require("../../middlewares/authentication");
const { getAllTransactions } = require("./transaction.controller");

const router = express.Router();

router.route("/").get(auth, isAdmin, getAllTransactions);

module.exports = router;
