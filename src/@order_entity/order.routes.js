const express = require("express");

const { auth, isAdmin } = require("../../middlewares/authentication");
const {
  createRazorpayOrder,
  verifyRazorpayPayment,
  getApiKey,
  hasSubscription,
  mySubscription,
  createCashFreeOrder,
  verifyCashFreePayment,
  createPaypalOrder,
  verifyPaypalOrder,
  getorderHistory,
} = require("./order.controller");

const router = express.Router();

// Razor-pay
router.route("/razor-pay").post(auth, createRazorpayOrder);
router.route("/get-key").get(auth, getApiKey);
router.route("/razor-pay/verify").post(auth, verifyRazorpayPayment);

// Cash-free
router.route("/cash-free").post(auth, createCashFreeOrder);
router.route("/cash-free/verify").get(auth, verifyCashFreePayment);

// Paypal
router.route("/paypal").post(auth, createPaypalOrder);
router.route("/paypal/:id").post(auth, verifyPaypalOrder);

router.route("/has-subscription/:userId").get(hasSubscription);

router.route("/my-subscription").get(auth, mySubscription);

router.route("/history").get(auth, getorderHistory);

module.exports = router;
