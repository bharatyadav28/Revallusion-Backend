const express = require("express");

const { auth, isAdmin } = require("../../middlewares/authentication");
const {
  createOrder,
  verifyPayment,
  getApiKey,
  hasSubscription,
  mySubscription,
} = require("./order.controller");

const router = express.Router();

router.route("/").post(auth, createOrder);

router.route("/get-key").get(auth, getApiKey);

router.route("/verify-payment").post(auth, verifyPayment);

router.route("/has-subscription/:userId").get(hasSubscription);

router.route("/my-subscription").get(auth, mySubscription);

module.exports = router;
