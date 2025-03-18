const StatusCodes = require("http-status-codes");

const { instance } = require("../../app");
const crypto = require("crypto");
const { BadRequestError, NotFoundError } = require("../../errors");

const UserModel = require("../@user_entity/user.model");
const PlanModel = require("../@plan_entity/plan.model");
const TransactionModel = require("../@transaction_entity/transaction.model");
const OrderModel = require("./order.model");
const {
  StringToObjectId,
  getFrontendDomain,
  isoToReadable,
} = require("../../utils/helperFuns");
const { default: mongoose } = require("mongoose");

// Create a new order
exports.createOrder = async (req, res) => {
  const { plan } = req.body;
  const userId = req?.user?._id;

  const user = await UserModel.findById(userId);
  if (!user)
    throw new NotFoundError("Account not found, please create a new account");

  if (!plan) {
    throw new BadRequestError("Please provide a plan id");
  }

  // Check if plan is valid
  const existingPlan = await PlanModel.findById(plan);
  if (!existingPlan) throw new NotFoundError("Plan not found");

  let expiry_date = new Date();
  let remainingAmount = 0;

  // Check if user already has an active order
  const activeOrder = await OrderModel.findOne({
    user: StringToObjectId(userId),
    status: "Active",
  }).populate({
    path: "plan",
    select: "plan_type validity inr_price level",
  });

  if (activeOrder) {
    const today = Date.now();

    if (activeOrder.expiry_date <= today) {
      // Active order is expired

      activeOrder.status = "Expire";
      await activeOrder.save();
    } else {
      // Calculate remaining balance from current active order
      const activePlanLevel = activeOrder.plan.level;
      const newPlanLevel = existingPlan.level;

      // Advance dynamic check
      if (
        activePlanLevel === newPlanLevel ||
        (activePlanLevel === Number(process.env.ADVANCE_PLAN) &&
          newPlanLevel === Number(process.env.BEGINNER_PLAN))
      ) {
        throw new BadRequestError("You already have this plan");
      }

      // Active plan stats
      const activeRemainingDays = Math.ceil(
        (activeOrder.expiry_date - today) / (1000 * 60 * 60 * 24)
      );

      // Active plan price validity
      const activeValidity = activeOrder.plan.validity / (60 * 60 * 24);

      // Active plan per day amount
      const activePerDayAmount = activeOrder.plan.inr_price / activeValidity;
      remainingAmount = activeRemainingDays * activePerDayAmount;
    }
  }

  // New order validity
  const validityInDays = existingPlan.validity / (60 * 60 * 24);
  expiry_date.setDate(expiry_date.getDate() + validityInDays);

  // Amount in Rupees
  const amount = Math.floor(existingPlan.inr_price - remainingAmount);
  const paise = Number(amount) * 100;

  // Razorpay order
  var options = {
    amount: paise,
    currency: "INR",
  };
  const order = await instance.orders.create(options);

  // Save order to database
  const query = {
    user: userId,
    order_id: order.id,
    plan: existingPlan._id,
    inr_price: amount,
    expiry_date,
    status: "Pending",
    actual_price: existingPlan.inr_price,
  };

  const savedOrder = await OrderModel.create(query);
  if (!savedOrder) throw new BadRequestError("Order not created");

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Order created successfully",
    data: { order: savedOrder },
  });
};

// Razorpay public key
exports.getApiKey = async (req, res) => {
  res.status(StatusCodes.OK).json({
    success: true,
    data: { key: process.env.RAZORPAY_KEY_ID },
  });
};

// Payment verification
exports.verifyPayment = async (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
    req.body;

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Payment verification failed",
    });
  }

  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  const isAuthentic = generatedSignature === razorpay_signature;

  const order = await OrderModel.findOne({ order_id: razorpay_order_id });
  if (!order) {
    throw new NotFoundError("Order not found");
  }

  const transaction = await TransactionModel.create({
    order: order._id,
    user: order.user,
    payment_id: razorpay_payment_id,
    amount: order.inr_price,
    gateway: "Razorpay",
    status: "Pending",
  });

  // Check if payment is authentic
  if (!isAuthentic) {
    transaction.status = "Failed";
    const saveTransaction = transaction.save();
    const deleteOrder = order.deleteOne();

    await Promise.all([saveTransaction, deleteOrder]);

    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Payment verification failed",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Expire previous active order
    await OrderModel.findOneAndUpdate(
      { user: order.user, status: "Active" },
      { $set: { status: "Expire" } },
      { new: true, runValidators: true, session }
    );

    // Make current transaction comolete
    transaction.status = "Completed";
    const saveTransaction = transaction.save({ session });

    // Make current order active
    order.status = "Active";
    order.razorpay_signature = razorpay_signature;
    const saveOrder = order.save({ session });

    await Promise.all([saveTransaction, saveOrder]);

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }

  const frontendDomain = getFrontendDomain(req);
  return res.redirect(`${frontendDomain}/verify-payment`);

  // return res.status(StatusCodes.OK).json({
  //   success: true,
  //   message: "Payment verified successfully",
  // });
};

// Check if user has subscrition
exports.hasSubscription = async (req, res) => {
  const { userId } = req.params;

  const activeOrder = await OrderModel.findOne({
    user: StringToObjectId(userId),
    status: "Active",
  });

  let hasSubscription = false;
  if (activeOrder) hasSubscription = true;

  return res.status(StatusCodes.OK).json({
    success: true,
    data: { hasSubscription },
  });
};

// User subscription details
exports.mySubscription = async (req, res) => {
  const userId = req.user._id;

  let hasSubscription = false;
  let subscriptionDetails = null;

  const activeOrder = await OrderModel.findOne({
    user: userId,
    status: "Active",
  }).populate({ path: "plan", select: "plan_type" });

  if (activeOrder) {
    hasSubscription = true;

    const planType = activeOrder.plan.plan_type;
    const paidOn = isoToReadable(activeOrder.start_date);

    const today = new Date();
    const planExpiryDate = activeOrder.expiry_date;
    const remainingDays = Math.floor(
      (planExpiryDate - today) / (1000 * 60 * 60 * 24)
    );

    subscriptionDetails = {
      planType,
      paidOn,
      remainingDays,
    };
  }

  return res.status(StatusCodes.OK).json({
    succes: true,
    message: "Subscription details fetched successfully",
    data: {
      hasSubscription,
      subscriptionDetails,
    },
  });
};
