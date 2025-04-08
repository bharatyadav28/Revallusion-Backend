const express = require("express");

const { auth, isAdmin } = require("../../middlewares/authentication");
const {
  createRazorpayOrder,
  verifyRazorpayPayment,
  getApiKey,
  hasSubscription,
  mySubscription,
} = require("./order.controller");

const router = express.Router();

// Razor-pay
router.route("/razor-pay").post(auth, createRazorpayOrder);
router.route("/get-key").get(auth, getApiKey);
router.route("/razor-pay/verify").post(auth, verifyRazorpayPayment);

router.route("/has-subscription/:userId").get(hasSubscription);

router.route("/my-subscription").get(auth, mySubscription);

module.exports = router;
