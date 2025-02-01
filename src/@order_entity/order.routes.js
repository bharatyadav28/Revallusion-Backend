const express = require("express");

const { auth, isAdmin } = require("../../middlewares/authentication");
const { createOrder, verifyPayment, getApiKey } = require("./order.controller");

const router = express.Router();

router.route("/").post(createOrder);

router.route("/get-key").get(getApiKey);

router.route("/verify-payment").post(verifyPayment);

module.exports = router;
