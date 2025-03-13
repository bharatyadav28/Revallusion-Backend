const mongoose = require("mongoose");
const StatusCodes = require("http-status-codes");

const userModel = require("../@user_entity/user.model");
const OrderModel = require("../@order_entity/order.model");
const PlanModel = require("../@plan_entity/plan.model");
const { NotFoundError, BadRequestError } = require("../../errors");
const {
  updateSessionAndCreateTokens,
} = require("../@user_entity/user.controller");
const {
  generateDeviceId,
  getDeviceData,
  filterUserData,
} = require("../../utils/helperFuns");
const { s3AdminUploadv4 } = require("../../utils/s3");
const { instance } = require("../../app");

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

  // Get file type
  const fileType = req.file.mimetype.split("/")[0];

  let uploadResult;
  if (fileType === "image") {
    uploadResult = await s3AdminUploadv4(req.file);
  } else {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "Unsupported file type" });
  }

  // Generate image URL
  const result = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_BUCKET_REGION}.amazonaws.com/${uploadResult.Key}`;

  return res.status(StatusCodes.OK).json({
    success: true,
    data: { imageUrl: result },
    message: "Image uploaded successfully",
  });
};

exports.sendMeAmin = async (req, res) => {
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

  const uploadResult = await s3AdminUploadv4(req.file);

  // Generate image URL
  const result = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_BUCKET_REGION}.amazonaws.com/${uploadResult.Key}`;

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
  let { search, currentPage, resultsPerPage } = req.query;

  // Query for aggregation
  let query = { isDeleted: false, role: "user" };
  search = search?.trim();
  if (search) {
    const searchRegExp = new RegExp(search, "i");
    query.$or = [
      { name: { $regex: searchRegExp } },
      { email: { $regex: searchRegExp } },
    ];
  }

  const limit = resultsPerPage || 10;
  const page = currentPage || 1;
  const skip = (page - 1) * limit;

  const users = await userModel.aggregate([
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
      $project: {
        name: { $ifNull: ["$name", null] },
        email: 1,
        mobile: { $ifNull: ["$mobile", null] },
      },
    },
  ]);

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "User details fetched successfully",
    data: {
      users,
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
      $project: {
        name: 1,
        email: 1,
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
      details,
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

  const user = await userModel.create({
    name,
    email,
    mobile,
    isEmailVerified: true,
  });

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
  const { name, email, mobile, plan, isPlanUpdated } = req.body;
  const { id: userId } = req.params;

  if (!email) {
    throw new BadRequestError("Email cannot be empty");
  }

  const existingUserPromise = userModel.findOne({ email });
  let planPromise = null;
  if (isPlanUpdated && plan) {
    planPromise = await PlanModel.findById(plan);
  }

  const [existingUser, existingPlan] = await Promise.all([
    existingUserPromise,
    planPromise,
  ]);

  // if (existingUser)
  //   throw new BadRequestError("User with this email already exists");
  if (plan && !existingPlan)
    throw new BadRequestError("Targeted plan doesnot exist");

  const updatedUser = await userModel.findByIdAndUpdate(
    userId,
    {
      name,
      email,
      mobile,
    },
    {
      runValidators: true,
      new: true,
    }
  );

  if (!updatedUser) {
    console.log("UpadteUser", this.updateUser);
    throw new BadRequestError("User updation failed");
  }

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

        // Razorpay order
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
      }

      await session.commitTransaction();
    } catch (error) {
      if (session) await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  return res.status(StatusCodes.OK).json({
    success: true,
    message: "User created successfully",
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
