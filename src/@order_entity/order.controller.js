const StatusCodes = require("http-status-codes");
const axios = require("axios");

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
const sendEmail = require("../../utils/sendEmail");
const { paymentSuccessTemplate } = require("../../utils/emailHTML");
// const { cashfree } = require("../../app");

// Helper functions
const getOrderDetails = async ({ plan, userId, isPaypalOrder }) => {
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
    select: "plan_type validity inr_price usd_price level",
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

      remainingAmount = isPaypalOrder
        ? activeOrder.plan.usd_price
        : activeOrder.plan.inr_price;
    }
  }

  const hasUpgraded = remainingAmount > 0 ? true : false;

  // New order validity
  const validityInDays = existingPlan.validity / (60 * 60 * 24);
  expiry_date.setDate(expiry_date.getDate() + validityInDays);

  const actual_price = isPaypalOrder
    ? existingPlan.usd_price
    : existingPlan.inr_price;
  // Amount in Rupees
  const amount = Math.floor(actual_price - remainingAmount);

  const orderDetails = {
    existingPlan: {
      _id: existingPlan._id,
      inr_price: existingPlan.inr_price,
      usd_price: existingPlan.usd_price,
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
  const isPaypalGateway = gateway === "Paypal";
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
    amount: isPaypalGateway ? order.usd_price : order.inr_price,
    gateway,
    status: "Pending",
  });

  const userPromise = UserModel.findById(userId).select(
    "name email mobile state"
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

    throw new BadRequestError("Payment verification failed");
  }

  // const session = await mongoose.startSession();
  // session.startTransaction();

  try {
    // Expire previous active order
    await OrderModel.findOneAndUpdate(
      { user: order.user, status: "Active" },
      { $set: { status: "Expire" } },
      { new: true, runValidators: true }
    );

    // Make current transaction comolete
    transaction.status = "Completed";
    const saveTransactionPromise = transaction.save();

    // Make current order active
    order.status = "Active";
    if (razorpay_signature) order.razorpay_signature = razorpay_signature;
    const saveOrderPromise = order.save();

    await Promise.all([saveTransactionPromise, saveOrderPromise]);

    const data = await sendInvoice({
      user,
      transaction,
      invoice_no: countTransactions + 1,
      plan_type: order.plan.plan_type,
    });

    const result = await s3Uploadv4(data, "invoices", "invoice");
    transaction.invoice_url = result?.Key;
    await transaction.save();

    try {
      const attachments = [
        {
          filename: `${"Ravallusion"}.pdf`,
          content: data.toString("base64"),
          encoding: "base64",
        },
      ];

      await sendEmail({
        to: user.email,
        subject: "Invoice",
        html: paymentSuccessTemplate({
          invoiceLink: `${awsUrl}/${result?.Key}`,
        }),
        attachments,
      });
      // console.log(data);
    } catch (error) {
      console.log(error);
      // res.status(400).send({ message: "something went wrong" });
    }

    // Commit the transaction
    // await session.commitTransaction();
  } catch (error) {
    // await session.abortTransaction();
    throw error;
  } finally {
    // session.endSession();
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
  return res.redirect(`${frontendDomain}/rajorpay-payment-success`);

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
      return_url: `${frontendDomain}/verify-payment-cashfree?order_id=${order_id}`,
      payment_methods: "upi,cc,dc,nb,app,banktransfer",

      // return_url: `https://ravallusion-repo-mine.vercel.app/verify-payment?order_id=${order_id}`,
    },
  };

  const response = await fetch(`${process.env.CF_BASE_URL}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-version": "2023-08-01",
      "x-client-id": process.env.CASHFREE_KEY_ID,
      "x-client-secret": process.env.CASHFREE_KEY_SECRET,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error?.message || "Payment failed");
  }
  const cashfreeData = await response.json();

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
  });
};

exports.verifyCashFreePayment = async (req, res) => {
  const { order_id: orderId } = req.query;
  if (!orderId) {
    throw new BadRequestError("Please enter order id");
  }

  let isAuthentic = false;

  const response = await fetch(`${process.env.CF_BASE_URL}/orders/${orderId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-api-version": "2023-08-01",
      "x-client-id": process.env.CASHFREE_KEY_ID,
      "x-client-secret": process.env.CASHFREE_KEY_SECRET,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error?.message || "Payment failed");
  }
  const cashfreeData = await response.json();

  isAuthentic = cashfreeData.order_status === "PAID";

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
  });
};

const getPaypalAccessToken = async (req, res) => {
  const auth = Buffer.from(
    process.env.PAYPAL_CLIENT_ID + ":" + process.env.PAYPAL_CLIENT_SECRET
  ).toString("base64");

  const response = await fetch(
    `${process.env.PAYPAL_BASE_URL}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`,
      },
      body: "grant_type=client_credentials",
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
};

exports.createPaypalOrder = async (req, res) => {
  const { plan } = req.body;
  const userId = req?.user?._id;

  const { existingPlan, amount, expiry_date, hasUpgraded, user } =
    await getOrderDetails({ plan, userId, isPaypalOrder: true });

  const accessToken = await getPaypalAccessToken();

  const response = await fetch(
    `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        application_context: {
          brand_name: "Ravallusion",
          landing_page: "LOGIN", // or "BILLING"
          user_action: "PAY_NOW", // Forces immediate payment
          return_url: `${process.env.FRONTEND_URL}/rajorpay-payment-success`, // frontend should call backend capture with token=id
          cancel_url: `${process.env.FRONTEND_URL}`,
          shipping_preference: "NO_SHIPPING",
        },
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: Number(amount).toFixed(2),
            },
          },
        ],
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new BadRequestError(data?.message);
  }
  // Save order to database
  const query = {
    user: userId,
    order_id: data.id,
    plan: existingPlan._id,
    usd_price: Number(amount).toFixed(2),
    expiry_date,
    status: "Pending",
    actual_price: existingPlan.usd_price,
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

exports.verifyPaypalOrder = async (req, res) => {
  const accessToken = await getPaypalAccessToken();
  const { id: orderID } = req.params;

  console.log("Verify paypal");

  const response = await fetch(
    `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders/${orderID}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new BadRequestError("Payment failed");
  }

  const isAuthentic = data.status === "COMPLETED";

  await activateSubscription({
    order_id: orderID,
    gateway: "Paypal",
    payment_id: data?.purchase_units?.[0]?.payments?.captures?.[0]?.id,
    isAuthentic,
    userId: req.user._id,
  });

  console.log("Verified!!!");

  const frontendDomain = getFrontendDomain(req);
  // return res.redirect(`${frontendDomain}/rajorpay-payment-success`);

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Payment verified successfully",
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

exports.getorderHistory = async (req, res) => {
  const userId = req.user._id;

  const orders = await OrderModel.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        status: { $in: ["Active", "Expire"] },
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
      $sort: {
        createdAt: -1,
      },
    },
    {
      $project: {
        _id: 0,
        planType: 1,
        invoice_url: 1,
        paidOn: 1,
        // hasUpgraded: 1,
        status: 1,
      },
    },
  ]);

  return res.status(StatusCodes.OK).json({
    succes: true,
    message: "Subscription details fetched successfully",
    data: {
      orders,
    },
  });
};
