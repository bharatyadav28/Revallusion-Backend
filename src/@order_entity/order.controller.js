const StatusCodes = require("http-status-codes");
const { Cashfree, CreateOr } = require("cashfree-pg");

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
  awsUrl,
  generateUniqueId,
} = require("../../utils/helperFuns");
const { default: mongoose } = require("mongoose");
const {
  sendInvoice,
} = require("../@transaction_entity/transaction.controller");
const { s3Uploadv4 } = require("../../utils/s3");
// const { cashfree } = require("../../app");

let cashfree = new Cashfree(
  "SANDBOX",
  process.env.CASHFREE_KEY_ID,
  process.env.CASHFREE_KEY_SECRET
);

// Helper functions
const getOrderDetails = async ({ plan, userId }) => {
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

      if (activePlanLevel === newPlanLevel) {
        throw new BadRequestError("You already have this plan");
      }

      // Advance dynamic check
      if (
        activePlanLevel === Number(process.env.ADVANCE_PLAN) &&
        newPlanLevel === Number(process.env.BEGINNER_PLAN)
      ) {
        throw new BadRequestError(
          "Your active plan already includes this plan"
        );
      }

      remainingAmount = activeOrder.plan.inr_price;
    }
  }

  const hasUpgraded = remainingAmount > 0 ? true : false;

  // New order validity
  const validityInDays = existingPlan.validity / (60 * 60 * 24);
  expiry_date.setDate(expiry_date.getDate() + validityInDays);

  // Amount in Rupees
  const amount = Math.floor(existingPlan.inr_price - remainingAmount);

  const orderDetails = {
    existingPlan: {
      _id: existingPlan._id,
      inr_price: existingPlan.inr_price,
    },
    amount,
    expiry_date,
    hasUpgraded,
    user,
  };

  return orderDetails;
};

const activateSubscription = async ({
  order_id,
  gateway,
  payment_id,
  isAuthentic,
  userId,
  razorpay_signature,
}) => {
  const order = await OrderModel.findOne({
    order_id,
  }).populate({ path: "plan", select: "plan_type" });
  if (!order) {
    throw new NotFoundError("Order not found");
  }

  const transactionPromise = TransactionModel.create({
    order: order._id,
    user: order.user,
    payment_id,
    amount: order.inr_price,
    gateway,
    status: "Pending",
  });

  const userPromise = UserModel.findById(userId).select("name email mobile");
  const countTransactionsPromise = TransactionModel.countDocuments();

  const [transaction, user, countTransactions] = await Promise.all([
    transactionPromise,
    userPromise,
    countTransactionsPromise,
  ]);

  // Check if payment is authentic
  if (!isAuthentic) {
    transaction.status = "Failed";
    const saveTransaction = transaction.save();
    const deleteOrder = order.deleteOne();

    await Promise.all([saveTransaction, deleteOrder]);

    throw new BadRequestError("Payment verification failed");
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
    const saveTransactionPromise = transaction.save({ session });

    // Make current order active
    order.status = "Active";
    if (razorpay_signature) order.razorpay_signature = razorpay_signature;
    const saveOrderPromise = order.save({ session });

    await Promise.all([saveTransactionPromise, saveOrderPromise]);

    const data = await sendInvoice({
      user,
      transaction,
      invoice_no: countTransactions + 1,
      plan_type: order.plan.plan_type,
    });

    const result = await s3Uploadv4(data, "invoices", "invoice");
    transaction.invoice_url = result?.Key;
    await transaction.save({ session });

    // Commit the transaction
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

exports.createRazorpayOrder = async (req, res) => {
  const { plan } = req.body;
  const userId = req?.user?._id;

  const { existingPlan, amount, expiry_date, hasUpgraded } =
    await getOrderDetails({ plan, userId });

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
    hasUpgraded,
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

exports.verifyRazorpayPayment = async (req, res) => {
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

  await activateSubscription({
    order_id: razorpay_order_id,
    gateway: "Razorpay",
    payment_id: razorpay_payment_id,
    isAuthentic,
    userId: req.user._id,
    razorpay_signature,
  });

  const frontendDomain = getFrontendDomain(req);
  return res.redirect(`${frontendDomain}/verify-payment`);

  // return res.status(StatusCodes.OK).json({
  //   success: true,
  //   message: "Payment verified successfully",
  // });
};

exports.createCashFreeOrder = async (req, res) => {
  const { plan } = req.body;
  const userId = req?.user?._id;

  const { existingPlan, amount, expiry_date, hasUpgraded, user } =
    await getOrderDetails({ plan, userId });

  const uuid = generateUniqueId();
  const order_id = `cf_${uuid}`;
  const frontendDomain = getFrontendDomain(req);
  console.log("Frontend domain: ", frontendDomain);

  let request = {
    order_amount: amount,
    order_currency: "INR",
    order_id,
    customer_details: {
      customer_id: userId,
      customer_name: user?.name || "user",
      customer_email: user.email,
      customer_phone: user?.mobile || "+919999999999",
    },

    order_meta: {
      return_url: `${frontendDomain}/verify-payment?order_id=${order_id}`,
    },
  };

  let cashfreeData = null;
  try {
    const response = await cashfree.PGCreateOrder(request);

    cashfreeData = response?.data;
  } catch (error) {
    throw new BadRequestError(error.response?.data.message);
  }

  // Save order to database
  const query = {
    user: userId,
    order_id,
    plan: existingPlan._id,
    inr_price: amount,
    expiry_date,
    status: "Pending",
    actual_price: existingPlan.inr_price,
    hasUpgraded,
  };

  const savedOrder = await OrderModel.create(query);
  if (!savedOrder) throw new BadRequestError("Order not created");

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Order created successfully",
    data: { payment_session_id: cashfreeData.payment_session_id },
    // data: { cashfreeData },
  });
};

exports.verifyCashFreePayment = async (req, res) => {
  const { order_id: orderId } = req.query;

  if (!orderId) {
    throw new BadRequestError("Please enter order id");
  }

  let isAuthentic = false;

  let cashfreeData = null;
  try {
    const response = await cashfree.PGFetchOrder(orderId);
    cashfreeData = response?.data;
    isAuthentic = cashfreeData.order_status === "PAID";
  } catch (error) {
    throw new BadRequestError(error.response?.data.message);
  }

  await activateSubscription({
    order_id: orderId,
    gateway: "Cashfree",
    payment_id: cashfreeData.cf_order_id,
    isAuthentic,
    userId: req.user._id,
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Payment verified successfully",
    // data: { order: savedOrder, cashfreeData },
  });
};

// Check if user has subscription
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

  const [activeOrder] = await OrderModel.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        status: "Active",
      },
    },
    {
      $lookup: {
        from: "plans",
        let: { planId: "$plan" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$_id", "$$planId"] },
            },
          },
          {
            $project: {
              _id: 0,
              plan_type: 1,
            },
          },
        ],
        as: "plan",
      },
    },
    {
      $lookup: {
        from: "transactions",
        let: { orderId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$order", "$$orderId"] },
            },
          },
          {
            $set: {
              invoice_url: {
                $cond: {
                  if: {
                    $and: [
                      { $ifNull: ["$invoice_url", false] },
                      { $ne: ["$invoice_url", ""] },
                    ],
                  },
                  then: {
                    $concat: [awsUrl, "/", { $toString: "$invoice_url" }],
                  },
                  else: null,
                },
              },
            },
          },
          {
            $project: {
              _id: 0,
              invoice_url: 1,
            },
          },
        ],
        as: "transaction",
      },
    },
    {
      $set: {
        planType: { $arrayElemAt: ["$plan.plan_type", 0] },
        invoice_url: { $arrayElemAt: ["$transaction.invoice_url", 0] },
        paidOn: {
          $dateToString: {
            format: "%d/%m/%Y",
            date: "$start_date",
          },
        },
        remainingDays: {
          $floor: {
            $divide: [
              { $subtract: ["$expiry_date", new Date()] },
              1000 * 60 * 60 * 24,
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        planType: 1,
        invoice_url: 1,
        paidOn: 1,
        remainingDays: 1,
      },
    },
  ]);

  return res.status(StatusCodes.OK).json({
    succes: true,
    message: "Subscription details fetched successfully",
    data: {
      hasSubscription: activeOrder ? true : false,
      subscriptionDetails: activeOrder,
    },
  });
};
