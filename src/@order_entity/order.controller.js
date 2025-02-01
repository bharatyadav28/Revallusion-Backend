const StatusCodes = require("http-status-codes");

const { instance } = require("../../app");
const crypto = require("crypto");
const { BadRequestError, NotFoundError } = require("../../errors");

const UserModel = require("../@user_entity/user.model");
const PlanModel = require("../@plan_entity/plan.model");
const TransactionModel = require("../@transaction_entity/transaction.model");
const OrderModel = require("./order.model");
const { StringToObjectId } = require("../../utils/helperFuns");

// Create a new order
exports.createOrder = async (req, res) => {
  const { plan } = req.body;
  const userId = req?.user?._id || "6776754159ca30b48917b457";

  const user = await UserModel.findById(userId);
  if (!user)
    throw new NotFoundError("Account not found, please create a new account");

  if (!plan) {
    throw new BadRequestError("Please provide a plan id");
  }

  // check if plan is valid
  const existingPlan = await PlanModel.findById(plan);
  if (!existingPlan) throw new NotFoundError("Plan not found");

  let expiry_date = new Date();
  let remainingAmount = 0;

  const activeOrder = await OrderModel.findOne({
    user: StringToObjectId(userId),
    // status: "Active",
  }).populate({
    path: "plan",
    select: "plan_type validity inr_price",
  });

  console.log("Active order: ", activeOrder);
  // Check if user already has an active order
  if (activeOrder) {
    const today = Date.now();

    if (activeOrder.expiry_date <= today) {
      // Active order is expired

      activeOrder.status = "Expire";
      await activeOrder.save();
    } else {
      // Calculate remaining balance from current active order
      const activePlanType = activeOrder.plan.plan_type;
      const newPlanType = existingPlan.plan_type;

      if (
        activePlanType === newPlanType ||
        (activePlanType === "Advanced" && newPlanType === "Begineer")
      ) {
        throw new BadRequestError("You already have this plan");
      }

      // Active plan stats
      const activeRemainingDays = Math.ceil(
        (activeOrder.expiry_date - today) / (1000 * 60 * 60 * 24)
      );

      const activeValidity = activeOrder.plan.validity / (60 * 60 * 24);
      const activePerDayAmount = Math.floor(
        activeOrder.plan.inr_price / activeValidity
      );

      remainingAmount = activeRemainingDays * activePerDayAmount;
      console.log("Remaining amount: ", remainingAmount);
    }
  }

  // New order validity
  const validityInDays = existingPlan.validity / (60 * 60 * 24);
  expiry_date.setDate(expiry_date.getDate() + validityInDays);
  console.log("Expire date: ", expiry_date);

  // Amount in Rupees
  const amount = existingPlan.inr_price - remainingAmount;
  const paise = Number(amount) * 100;

  // Razorpay order
  var options = {
    amount: paise,
    currency: "INR",
  };
  const order = await instance.orders.create(options);
  //   console.log("Order: ", order);

  // Save order to database
  const query = {
    user: userId,
    order_id: order.id,
    plan: existingPlan._id,
    inr_price: amount,
    expiry_date,
    status: "Pending",
    actual_price: amount,
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

  console.log("Signatures", razorpay_signature, generatedSignature);

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

  transaction.status = "Completed";
  const saveTransaction = transaction.save();

  order.status = "Active";
  order.razorpay_signature = razorpay_signature;
  const saveOrder = order.save();

  await Promise.all([saveTransaction, saveOrder]);

  //   res.redirect("")

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Payment verified successfully",
  });
};
