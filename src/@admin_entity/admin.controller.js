const mongoose = require("mongoose");
const StatusCodes = require("http-status-codes");

const userModel = require("../@user_entity/user.model");
const OrderModel = require("../@order_entity/order.model");
const PlanModel = require("../@plan_entity/plan.model");
const TransactionModel = require("../@transaction_entity/transaction.model");
const { NotFoundError, BadRequestError } = require("../../errors");
const {
  updateSessionAndCreateTokens,
} = require("../@user_entity/user.controller");
const {
  generateDeviceId,
  getDeviceData,
  filterUserData,
  awsUrl,
} = require("../../utils/helperFuns");
const { s3AdminUploadv4, s3Uploadv4 } = require("../../utils/s3");
const { instance } = require("../../app");
const {
  generateUserCertificates,
} = require("../@certificate_entity/certificate.controller");
const CertificateModel = require("../@certificate_entity/certificate.model");
const QueryModel = require("../@query_entity/query.model");
const {
  sendInvoice,
} = require("../@transaction_entity/transaction.controller");

// Admin signin
exports.adminSignin = async (req, res) => {
  const { email, password, keepMeSignedIn } = req.body;

  // Check required fields
  if (!email) {
    throw new BadRequestError("Please enter email");
  }
  if (!password) {
    throw new BadRequestError("Please enter password");
  }

  let query = { email: email, isDeleted: false, role: "admin" };
  let user = await userModel.findOne(query).select("+password");

  if (!user || !user.isEmailVerified) {
    throw new NotFoundError("Incorrect email or password");
  }

  const isMatchPassword = await user.comparePassword(password);
  if (!isMatchPassword) {
    throw new BadRequestError("Invalid Password");
  }

  await updateSessionAndCreateTokens({
    req,
    res,
    user,
    deviceId: generateDeviceId(req),
    ua: getDeviceData(req),
    keepMeSignedIn: keepMeSignedIn || false,
  });

  const userData = filterUserData(user);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Signin successfully",
    data: { user: userData },
  });
};

// Update profile
exports.adminUpdateProfile = async (req, res) => {
  const { name, email, password } = req.body;

  const user = await userModel.findOne({
    _id: req.user._id,
    isDeleted: false,
    role: "admin",
  });
  if (!user) {
    return BadRequestError("Somenthing went wrong while updating profile");
  }

  if (name) user.name = name;
  if (email) user.email = email;
  if (password) user.password = password;
  await user.save();

  const userData = filterUserData(user);

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Profile updated successfully",
    data: { user: userData },
  });
};

// Upload image
exports.uploadImage = async (req, res) => {
  if (!req.file) {
    throw new BadRequestError("Please upload an image");
  }
  const folder = req.body.folder || "thumbnails";

  // Get file type
  const fileType = req.file.mimetype.split("/")[0];

  let uploadResult;
  if (fileType === "image") {
    uploadResult = await s3AdminUploadv4(req.file, folder);
  } else {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "Unsupported file type" });
  }

  // Generate image URL
  const result = `${awsUrl}/${uploadResult.Key}`;

  return res.status(StatusCodes.OK).json({
    success: true,
    data: { imageUrl: result },
    message: "Image uploaded successfully",
  });
};

exports.sendMeAdmin = async (req, res) => {
  const userId = req.user._id;

  const user = await userModel
    .findOne({ _id: userId, isDeleted: false })
    .select("_id name email mobile role isEmailVerified isMobileVerified")
    .lean();

  res.status(StatusCodes.OK).json({
    success: true,
    data: { user: { ...user } },
    message: "User details fetched successfully",
  });
};

// Upload any type of file
exports.uploadFile = async (req, res) => {
  if (!req.file) {
    throw new BadRequestError("Please upload an file");
  }
  const folder = req.body.folder || "resources";

  const uploadResult = await s3AdminUploadv4(req.file, folder);

  // Generate image URL
  const result = `${awsUrl}/${uploadResult.Key}`;

  return res.status(StatusCodes.OK).json({
    success: true,
    data: { imageUrl: result },
    message: "Image uploaded successfully",
  });
};

exports.createStaff = async (req, res) => {
  const { email, password } = req.body;

  const staffUser = await userModel.create({
    email,
    password,
    name: "Staff",
    isEmailVerified: true,
    role: "staff",
  });
  if (!staffUser) {
    throw new BadRequestError("Staff user creation failed");
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Staff user created successfully",
  });
};

exports.staffSignin = async (req, res) => {
  const { email, password, keepMeSignedIn } = req.body;

  // Check required fields
  if (!email) {
    throw new BadRequestError("Please enter email");
  }
  if (!password) {
    throw new BadRequestError("Please enter password");
  }

  let query = { email: email, isDeleted: false, role: "staff" };
  let user = await userModel.findOne(query).select("+password");

  if (!user) {
    throw new NotFoundError("Incorrect email or password");
  }

  const isMatchPassword = await user.comparePassword(password);
  if (!isMatchPassword) {
    throw new BadRequestError("Invalid Password");
  }

  await updateSessionAndCreateTokens({
    req,
    res,
    user,
    deviceId: generateDeviceId(req),
    ua: getDeviceData(req),
    keepMeSignedIn: keepMeSignedIn || false,
  });

  const userData = filterUserData(user);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Signin successfully",
    data: { user: userData },
  });
};

exports.getUsers = async (req, res) => {
  let { search, currentPage, resultsPerPage, selectedPlan } = req.query;

  // Query for aggregation
  let query = { isDeleted: false, role: "user" };
  search = search?.trim();
  if (search) {
    const searchRegExp = new RegExp(search, "i");
    query.$or = [
      { name: { $regex: searchRegExp } },
      { email: { $regex: searchRegExp } },
      { mobile: { $regex: searchRegExp } },
    ];
  }

  let query2 = {};
  if (selectedPlan === "noPlan") {
    query2 = { order: { $eq: [] } };
  }

  const limit = resultsPerPage || 8;
  const page = currentPage || 1;
  const skip = (page - 1) * limit;

  if (selectedPlan == "clear") {
    selectedPlan = null;
  }

  let usersPromise = null;
  if (selectedPlan && selectedPlan !== "noPlan") {
    usersPromise = OrderModel.aggregate([
      {
        $match: {
          plan: new mongoose.Types.ObjectId(selectedPlan),
          status: "Active",
          expiry_date: { $gte: new Date() },
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },

      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
      {
        $lookup: {
          from: "users",
          let: {
            userId: "$user",
          },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$_id", "$$userId"] },
              },
            },
            {
              $lookup: {
                from: "certificates",

                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$user", "$$userId"] },
                          { $eq: ["$isIssued", true] },
                        ],
                      },
                    },
                  },
                ],
                as: "certificates",
              },
            },
            {
              $project: {
                email: 1,
                name: 1,
                mobile: 1,
                certificates: 1,
              },
            },
          ],
          as: "user",
        },
      },
      {
        $unwind: "$user",
        // $set: { user: { $arrayElemAt: ["$user", 0] } },
      },
      {
        $project: {
          _id: "$user._id",
          name: { $ifNull: ["$user.name", null] },
          email: "$user.email",
          mobile: { $ifNull: ["$user.mobile", null] },
          plan: { $ifNull: ["$plan", null] },
          certificates: "$user.certificates",
        },
      },
    ]);
  } else if (selectedPlan === "noPlan") {
    usersPromise = userModel.aggregate([
      {
        $match: query,
      },
      {
        $sort: {
          createdAt: -1,
        },
      },

      {
        $lookup: {
          from: "orders",
          let: {
            userId: "$_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$user", "$$userId"] },
                    { $eq: ["$status", "Active"] },
                    { $gte: ["$expiry_date", new Date()] },
                  ],
                },
              },
            },
            {
              $project: {
                plan: 1,
              },
            },
          ],
          as: "order",
        },
      },
      {
        $match: query2,
      },

      {
        $skip: skip,
      },
      {
        $limit: limit,
      },

      {
        $set: {
          plan: { $arrayElemAt: ["$order.plan", 0] },
        },
      },

      {
        $lookup: {
          from: "certificates",
          foreignField: "user",
          localField: "_id",

          pipeline: [
            {
              $match: { isIssued: true },
            },
          ],
          as: "certificates",
        },
      },

      {
        $project: {
          name: { $ifNull: ["$name", null] },
          email: 1,
          mobile: { $ifNull: ["$mobile", null] },
          plan: { $ifNull: ["$plan", null] },
          certificates: 1,
        },
      },
    ]);
  } else {
    usersPromise = userModel.aggregate([
      {
        $match: query,
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
      {
        $lookup: {
          from: "orders",
          let: {
            userId: "$_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$user", "$$userId"] },
                    { $eq: ["$status", "Active"] },
                    { $gte: ["$expiry_date", new Date()] },
                  ],
                },
              },
            },
            {
              $project: {
                plan: 1,
              },
            },
          ],
          as: "order",
        },
      },
      {
        $match: query2,
      },

      {
        $set: {
          plan: { $arrayElemAt: ["$order.plan", 0] },
        },
      },

      {
        $lookup: {
          from: "certificates",
          foreignField: "user",
          localField: "_id",

          pipeline: [
            {
              $match: { isIssued: true },
            },
          ],
          as: "certificates",
        },
      },

      {
        $project: {
          name: { $ifNull: ["$name", null] },
          email: 1,
          mobile: { $ifNull: ["$mobile", null] },
          plan: { $ifNull: ["$plan", null] },
          certificates: 1,
        },
      },
    ]);
  }

  let totalUsersPromise = null;
  if (selectedPlan && selectedPlan !== "noPlan") {
    totalUsersPromise = OrderModel.aggregate([
      {
        $match: {
          plan: new mongoose.Types.ObjectId(selectedPlan),
          status: "Active",
          // expiry_date: { $gte: new Date() },
        },
      },
      {
        $count: "usersCount",
      },
    ]);
  } else if (selectedPlan === "noPlan") {
    totalUsersPromise = userModel.aggregate([
      {
        $match: query,
      },
      {
        $sort: {
          createdAt: -1,
        },
      },

      {
        $lookup: {
          from: "orders",
          let: {
            userId: "$_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$user", "$$userId"] },
                    { $eq: ["$status", "Active"] },
                    { $gte: ["$expiry_date", new Date()] },
                  ],
                },
              },
            },
            {
              $project: {
                plan: 1,
              },
            },
          ],
          as: "order",
        },
      },

      {
        $match: query2,
      },

      {
        $count: "usersCount",
      },
    ]);
  } else {
    totalUsersPromise = userModel.countDocuments(query);
  }

  const [users, totalUsers] = await Promise.all([
    usersPromise,
    totalUsersPromise,
  ]);

  const usersCount = totalUsers[0]?.usersCount || totalUsers;
  const pagesCount = Math.ceil(usersCount / limit) || 1;

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "User details fetched successfully",
    data: {
      users,
      pagesCount,
    },
  });
};

exports.userDetails = async (req, res) => {
  const { id } = req.params;

  const detailsPromise = userModel.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(id),
      },
    },
    {
      $set: {
        avatar: {
          $ifNull: [{ $concat: [awsUrl, "/", "$avatar"] }, null],
        },
      },
    },

    {
      $lookup: {
        from: "transactions",
        let: {
          userId: "$_id",
        },

        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$user", "$$userId"],
              },
            },
          },
          {
            $lookup: {
              from: "orders",
              let: {
                orderId: "$order",
              },

              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: ["$_id", "$$orderId"],
                    },
                  },
                },

                {
                  $project: {
                    _id: 0,
                    plan: 1,
                  },
                },
              ],
              as: "order",
            },
          },
          {
            $set: {
              plan: {
                $arrayElemAt: ["$order.plan", 0],
              },
            },
          },
          {
            $project: {
              payment_id: 1,
              gateway: 1,
              amount: 1,
              status: 1,
              // order: 1,
              plan: 1,
              createdAt: 1,
            },
          },
        ],
        as: "transactions",
      },
    },

    {
      $lookup: {
        from: "certificates",
        let: {
          userId: "$_id",
        },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$user", "$$userId"] },
            },
          },
          {
            $project: {
              completionTime: 1,
              completionDate: "$createdAt",
              path: {
                $concat: [awsUrl, "/", "$path"],
              },
            },
          },
        ],
        as: "certificate",
      },
    },
    {
      $set: {
        certificate: { $arrayElemAt: ["$certificate", 0] },
      },
    },

    {
      $project: {
        name: 1,
        email: 1,
        certificate: 1,
        avatar: 1,
        mobile: 1,
        transactions: 1,
      },
    },
  ]);

  const activeOrderPromise = OrderModel.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(id),
        status: "Active",
        expiry_date: { $gte: new Date() },
      },
    },

    {
      $project: {
        plan: 1,
        createdAt: 1,
        expiry_date: 1,
      },
    },
  ]);

  const [[details], [activeOrder]] = await Promise.all([
    detailsPromise,
    activeOrderPromise,
  ]);

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "User details fetched successfully",
    data: {
      user: details,
      activeOrder: activeOrder || null,
    },
  });
};

exports.createUser = async (req, res) => {
  const { name, email, mobile, plan } = req.body;

  if (!email) {
    throw new BadRequestError("Email cannot be empty");
  }

  const existingUserPromise = userModel.findOne({ email });
  let planPromise = null;
  if (plan) {
    planPromise = await PlanModel.findById(plan);
  }

  const [existingUser, existingPlan] = await Promise.all([
    existingUserPromise,
    planPromise,
  ]);

  if (existingUser)
    throw new BadRequestError("User with this email already exists");
  if (plan && !existingPlan)
    throw new BadRequestError("Targeted plan doesnot exist");

  const body = { email };
  if (mobile) body.mobile = mobile;
  if (plan) body.plan = plan;
  if (name) body.name = name;
  const user = await userModel.create(body);

  if (!user) {
    throw new BadRequestError("User creation failed");
  }

  if (existingPlan) {
    const planValidityInDays = existingPlan.validity / (60 * 60 * 24);
    let expiry_date = new Date();
    expiry_date.setDate(expiry_date.getDate() + planValidityInDays);

    // Razorpay order
    const amount = existingPlan.inr_price;
    const paise = Number(amount) * 100;
    var options = {
      amount: paise,
      currency: "INR",
    };
    const order = await instance.orders.create(options);

    const query = {
      user: user._id,
      order_id: order.id,
      plan: existingPlan._id,
      inr_price: amount,
      expiry_date,
      status: "Active",
      actual_price: amount,
    };

    const newOrder = await OrderModel.create(query);
    if (!newOrder) {
      throw new BadRequestError("Order creation failed");
    }
  }
  return res.status(StatusCodes.OK).json({
    success: true,
    message: "User created successfully",
  });
};

exports.updateUser = async (req, res) => {
  const { name, email, mobile, plan, isPlanUpdated, issuedCertificates } =
    req.body;
  const { id: userId } = req.params;

  if (!email) {
    throw new BadRequestError("Email cannot be empty");
  }

  const existingUserPromise = userModel.findOne({
    _id: userId,
    isDeleted: false,
  });
  const existingCertificatesPromise = CertificateModel.find({
    user: userId,
    isIssued: true,
  });

  let planPromise = null;
  if (isPlanUpdated && plan) {
    planPromise = await PlanModel.findById(plan);
  }

  const [existingUser, existingCertificates, existingPlan] = await Promise.all([
    existingUserPromise,
    existingCertificatesPromise,
    planPromise,
  ]);

  if (isPlanUpdated && plan && !existingPlan)
    throw new BadRequestError("Targeted plan doesnot exist");

  const body = { email };
  if (name) body.name = name;
  if (mobile) body.mobile = mobile;

  const updatedUser = await userModel.findByIdAndUpdate(userId, body, {
    runValidators: true,
    new: true,
  });

  if (!updatedUser) {
    throw new BadRequestError("User updation failed");
  }

  // Plan
  if (isPlanUpdated) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const activeOrder = await OrderModel.updateOne(
        {
          user: existingUser._id,
          status: "Active",
        },
        {
          status: "Expire",
        },
        {
          session,
        }
      );

      if (plan) {
        const planValidityInDays = existingPlan.validity / (60 * 60 * 24);
        let expiry_date = new Date();
        expiry_date.setDate(expiry_date.getDate() + planValidityInDays);

        const amount = existingPlan.inr_price;
        const paise = Number(amount) * 100;
        var options = {
          amount: paise,
          currency: "INR",
        };
        const order = await instance.orders.create(options);

        const newOrder = new OrderModel({
          user: existingUser._id,
          order_id: order.id,
          plan: existingPlan._id,
          inr_price: amount,
          expiry_date,
          status: "Active",
          actual_price: existingPlan.inr_price,
        });

        await newOrder.save({ session });

        console.log("Payment id", newOrder, amount);

        const newTransaction = new TransactionModel({
          order: newOrder?._id,
          user: existingUser._id,
          payment_id: newOrder?._id,
          amount: amount,
          gateway: "Manual",
          status: "Completed",
        });
        const transactionPromise = newTransaction.save({ session });
        const countTransactionsPromise = TransactionModel.countDocuments();

        const [transaction, countTransactions] = await Promise.all([
          transactionPromise,
          countTransactionsPromise,
        ]);

        const data = await sendInvoice({
          user: existingUser,
          transaction,
          invoice_no: countTransactions + 1,
          plan_type: existingPlan.plan_type,
        });

        const result = await s3Uploadv4(data, "invoices", "invoice");
        transaction.invoice_url = result?.Key;
        await transaction.save({ session });
      }

      await session.commitTransaction();
    } catch (error) {
      if (session) await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Certificate
  let byPassCertificateMuatation = false;

  requestedCertificates = issuedCertificates?.filter(
    (item) => item.certificate
  );

  const toCreateCertificates =
    requestedCertificates?.filter(
      (item) =>
        !existingCertificates?.some(
          (subItem) => subItem?.plan.toString() === item._id.toString()
        )
    ) || [];

  const toDeleteCertificates = existingCertificates?.filter(
    (item) =>
      !requestedCertificates?.some(
        (subItem) => subItem?._id.toString() === item.plan.toString()
      )
  );

  if (
    toCreateCertificates?.length === 0 &&
    toDeleteCertificates?.length === 0
  ) {
    byPassCertificateMuatation = true;
  }

  if (!byPassCertificateMuatation) {
    const certificatePromises = [];

    // Create user certificates(may be of multiple plans)
    if (toCreateCertificates?.length > 0) {
      const createPromise = generateUserCertificates({
        plans: toCreateCertificates,
        user: updatedUser,
      });
      certificatePromises.push(createPromise);
    }

    if (toDeleteCertificates?.length > 0) {
      const planIds = toDeleteCertificates?.map((certificate) =>
        certificate.plan.toString()
      );
      const deletePromise = CertificateModel.updateMany(
        {
          user: userId,
          plan: { $in: planIds },
        },
        {
          $set: {
            isIssued: false,
            path: "",
          },
        }
      );
      certificatePromises.push(deletePromise);
    }

    if (certificatePromises.length > 0) {
      try {
        await Promise.all(certificatePromises);
      } catch (error) {
        throw new BadRequestError(error.message);
      }
    }
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "User updated successfully",
  });
};

exports.deleteUser = async (req, res) => {
  const { id: userId } = req.params;

  const deletedUser = await userModel.findByIdAndUpdate(userId, {
    isDeleted: true,
    deletedAt: new Date(),
  });

  if (!deletedUser) {
    throw new BadRequestError("User deletion failed");
  }
  return res.status(StatusCodes.OK).json({
    success: true,
    message: "User deleted successfully",
  });
};

exports.getDashBoardContent = async (req, res) => {
  const userPromise = userModel.countDocuments({ isDeleted: false });

  const activeOrderPromise = OrderModel.aggregate([
    {
      $match: { status: "Active" },
    },
    {
      $group: {
        _id: "$plan",
        usersCount: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: "plans",
        localField: "_id",
        foreignField: "_id",
        as: "plan",
      },
    },
    {
      $set: {
        planName: {
          $arrayElemAt: ["$plan.plan_type", 0],
        },
      },
    },
    {
      $project: {
        _id: 0,
        planName: 1,
        usersCount: 1,
      },
    },
  ]);

  const ordersUpgradedPromise = OrderModel.aggregate([
    {
      $match: {
        hasUpgraded: true,
      },
    },
    {
      $group: {
        _id: "$user",
      },
    },
    { $count: "totalUpgradedUsers" },
  ]);

  const queriesPromise = QueryModel.countDocuments();

  // Calculate revenues

  const IST_OFFSET = 5.5 * 60 * 60 * 1000;
  const nowUTC = new Date(); // UTC time on Render or AWS
  const nowIST = new Date(nowUTC.getTime() + IST_OFFSET);

  const startOfDay = new Date(nowIST);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const startOfMonth = new Date(nowIST.getFullYear(), nowIST.getMonth(), 1);
  const startOfYear = new Date(nowIST.getFullYear(), 0, 1);

  // USTs corresponding to ISTs values
  const startOfDayUTC = new Date(startOfDay.getTime() - IST_OFFSET);
  const startOfWeekUTC = new Date(startOfWeek.getTime() - IST_OFFSET);
  const startOfMonthUTC = new Date(startOfMonth.getTime() - IST_OFFSET);
  const startOfYearUTC = new Date(startOfYear.getTime() - IST_OFFSET);

  const revenuesPromise = OrderModel.aggregate([
    {
      $match: {
        status: { $in: ["Active", "Expire"] },
        createdAt: { $gte: startOfYearUTC },
      },
    },
    {
      $group: {
        _id: null,
        daily: {
          $sum: {
            $cond: [{ $gte: ["$createdAt", startOfDayUTC] }, "$inr_price", 0],
          },
        },
        weekly: {
          $sum: {
            $cond: [{ $gte: ["$createdAt", startOfWeekUTC] }, "$inr_price", 0],
          },
        },
        monthly: {
          $sum: {
            $cond: [{ $gte: ["$createdAt", startOfMonthUTC] }, "$inr_price", 0],
          },
        },
        yearly: { $sum: "$inr_price" },
      },
    },
  ]);

  const [usersCount, activeOrder, ordersUpgraded, queries, revenues] =
    await Promise.all([
      userPromise,
      activeOrderPromise,
      ordersUpgradedPromise,
      queriesPromise,
      revenuesPromise,
    ]);

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Dashboard content fetched successfully",
    data: {
      usersCount,
      activeOrder,
      plansUpgraded: ordersUpgraded?.[0].totalUpgradedUsers,
      queries,
      revenues: revenues?.[0],
    },
  });
};
