const express = require("express");

const { auth, isAdmin } = require("../../middlewares/authentication");
const { createOrder, verifyPayment, getApiKey } = require("./order.controller");

const router = express.Router();

router.route("/").post(auth, createOrder);

router.route("/get-key").get(auth, getApiKey);

router.route("/verify-payment").post(auth, verifyPayment);

module.exports = router;
