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
  awsUrl,
} = require("../../utils/helperFuns");
const { default: mongoose } = require("mongoose");
const {
  sendInvoice,
} = require("../@transaction_entity/transaction.controller");
const { s3Uploadv4 } = require("../../utils/s3");

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

  const order = await OrderModel.findOne({
    order_id: razorpay_order_id,
  }).populate({ path: "plan", select: "plan_type" });
  if (!order) {
    throw new NotFoundError("Order not found");
  }

  const transactionPromise = TransactionModel.create({
    order: order._id,
    user: order.user,
    payment_id: razorpay_payment_id,
    amount: order.inr_price,
    gateway: "Razorpay",
    status: "Pending",
  });

  const userPromise = UserModel.findById(req.user._id).select(
    "name email mobile"
  );
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

    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Payment verification failed",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  let updatedTransaction;

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
    order.razorpay_signature = razorpay_signature;
    const saveOrderPromise = order.save({ session });

    await Promise.all([saveTransactionPromise, saveOrderPromise]);

    const data = await sendInvoice({
      user,
      transaction,
      invoice_no: countTransactions + 1,
      plan_type: order.plan.plan_type,
    });

    const result = await s3Uploadv4(data, user._id, "invoice");
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
