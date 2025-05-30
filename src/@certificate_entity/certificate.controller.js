const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const { StatusCodes } = require("http-status-codes");
const QRCode = require("qrcode");

const CertificateModel = require("./certificate.model");
const OrderModel = require("../@order_entity/order.model");
const PlanModel = require("../@plan_entity/plan.model.js");
const CourseModel = require("../@course_entity/course.model");
const VideoModel = require("../@video_entity/video.model.js");
const { BadRequestError, NotFoundError } = require("../../errors/index.js");
const { s3Uploadv4 } = require("../../utils/s3.js");
const sendEmail = require("../../utils/sendEmail");
const userModel = require("../@user_entity/user.model.js");
const {
  formatDateTime,
  appendBucketName,
} = require("../../utils/helperFuns.js");

// Test
exports.createCertfifcateTest = async (req, res) => {
  const tempFilePath = path.join("test", `certficate.pdf`);

  const doc = new PDFDocument({
    size: [1056, 816], // Width and height in points (1 point ≈ 1 px here)
  });

  const writeStream = fs.createWriteStream(tempFilePath);

  const imagePath = path.join(__dirname, "../../public", "/certificate.jpg");

  doc.image(imagePath, 0, 0, { width: 1056, height: 816 });

  const name = "Abhinav";
  const splitName = name.split(" ");

  let xIndex = splitName.length === 1 ? 450 : 400;

  doc
    .fillColor("#4486F4")
    .font("Helvetica-Bold")
    .fontSize(38)
    .text(name, xIndex, 276);

  doc
    .fillColor("#002C75")
    .font("Helvetica")
    .fontSize(30)
    .text("Advance Video Editing along with Motion Graphics", 200, 362.5);

  doc
    .fillColor("#4486F4")
    .font("Helvetica")
    .fontSize(17)
    .text("October 18, 2022", 502, 492);

  const verifyUrl = `${process.env.FRONTEND_URL}/certificate/4324`;
  // Generate the QR code as a data URL
  const qrCodeDataURL = await QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: "H",
    margin: 1,
    // width: 00,
    color: {
      dark: "#000",
      light: "#fff",
    },
  });

  // Add the QR code to the PDF
  doc.image(qrCodeDataURL, 90, 630, {
    width: 90,
  });

  // Finalize the PDF
  doc.end();
  doc.pipe(writeStream);

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Certificate created successfully",
  });
};

// Helper function for progress calculation
const calculateProgress = async ({ user, activePlan, isAdmin }) => {
  const userId = user?._id;
  let coveredCourseIds = [];

  // Fetch all course ids eligible under current plan
  if (activePlan?.level >= 1) {
    const [coveredCourses] = await PlanModel.aggregate([
      {
        $match: {
          level: {
            $lte: activePlan.level,
          },
        },
      },
      {
        $lookup: {
          from: "courses",
          foreignField: "plan",
          localField: "_id",
          as: "course",
          pipeline: [
            {
              $project: {
                _id: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: { path: "$course", preserveNullAndEmptyArrays: true },
      },
      {
        $group: {
          _id: null,
          courseIds: { $push: "$course._id" },
        },
      },
      {
        $project: {
          courseIds: 1,
          _id: 0,
        },
      },
    ]);

    coveredCourseIds = coveredCourses?.courseIds || [];
  }

  const progress = await VideoModel.aggregate([
    {
      $match: {
        course: {
          $in: coveredCourseIds,
        },
        isDeleted: false,
      },
    },
    {
      $lookup: {
        from: "videoprogresses",
        let: { videoId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$video", "$$videoId"] },
                  { $eq: ["$user", userId] },
                ],
              },
            },
          },
          {
            $project: {
              isCompleted: 1,
            },
          },
        ],
        as: "videoProgress",
      },
    },

    {
      $lookup: {
        from: "submittedassignments",
        let: { videoId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$video", "$$videoId"] },
                  { $eq: ["$user", userId] },
                  { $eq: ["$isRevoked", false] },
                ],
              },
            },
          },
          {
            $project: {
              score: 1,
            },
          },
        ],
        as: "submittedAssignment",
      },
    },
    {
      $set: {
        isCompleted: {
          $ifNull: [
            {
              $arrayElemAt: ["$videoProgress.isCompleted", 0],
            },
            false,
          ],
        },
        assignmentScore: {
          $ifNull: [
            {
              $arrayElemAt: ["$submittedAssignment.score", 0],
            },
            null,
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        // videos: { $push: "$$ROOT" },
        inCompleteVideos: { $sum: { $cond: ["$isCompleted", 0, 1] } },
        totalAssignments: {
          $sum: { $cond: [{ $ifNull: ["$assignment", false] }, 1, 0] },
        },
        scoresSum: {
          $sum: { $ifNull: ["$assignmentScore", 0] },
        },
        unGradedAssignments: {
          $sum: { $cond: [{ $ifNull: ["$assignmentScore", 0] }, 0, 1] },
        },
      },
    },
  ]);

  if (!progress.length) {
    throw new BadRequestError("No progress found for enrolled courses");
  }
  const { inCompleteVideos, totalAssignments, scoresSum, unGradedAssignments } =
    progress[0];

  if (!isAdmin && (inCompleteVideos > 0 || unGradedAssignments > 0)) {
    return {
      progress: null,
      averageAssigmentsScore: null,
    };
  }

  let averageAssigmentsScore = 0;

  if (totalAssignments > 0) {
    averageAssigmentsScore = (scoresSum / totalAssignments).toFixed(2);
  }

  return {
    progress,
    averageAssigmentsScore,
    plan: activePlan,
  };
};

// Save user progress on course completion when admin updates score of final assignment
exports.saveUserProgress = async (userId) => {
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
        localField: "plan",
        foreignField: "_id",
        as: "plan",
      },
    },
    {
      $set: {
        plan: { $arrayElemAt: ["$plan", 0] },
      },
    },
  ]);

  if (activeOrder) {
    const activePlan = activeOrder.plan;
    const user = { _id: activeOrder.user };
    const completionTime = Math.floor(
      (new Date() - activeOrder.createdAt) / 1000
    );

    const { progress, averageAssigmentsScore } = await calculateProgress({
      user,
      activePlan,
      isAdmin: false,
    });

    if (progress && averageAssigmentsScore) {
      const existingProgress = await CertificateModel.findOne({
        user: userId,
        plan: activePlan,
      });
      if (existingProgress) {
        existingProgress.averageAssigmentsScore = averageAssigmentsScore;
        existingProgress.totalAssignments = progress[0].totalAssignments;
        existingProgress.scoresSum = progress[0].scoresSum;
        existingProgress.completionTime = completionTime;

        await existingProgress.save();
      } else {
        await CertificateModel.create({
          user: userId,
          plan: activePlan,
          averageAssigmentsScore,
          totalAssignments: progress[0].totalAssignments,
          scoresSum: progress[0].scoresSum,
          completionTime,
        });
      }
    }
  }
};

const createCertificateBuffer = async ({
  user,
  averageAssigmentsScore,
  activePlan,
  certificateId,
}) => {
  const verifyUrl = `${process.env.FRONTEND_URL}/certificate/${certificateId}`;
  // Generate the QR code as a data URL
  const qrCodeDataURL = await QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: "H",
    margin: 1,
    // width: 00,
    color: {
      dark: "#000",
      light: "#fff",
    },
  });

  return new Promise((resolve, reject) => {
    const tempFilePath = path.join("/tmp", `${user._id}.pdf`);

    const doc = new PDFDocument({
      size: [1056, 816], // Width and height in points (1 point ≈ 1 px here)
    });

    const writeStream = fs.createWriteStream(tempFilePath);

    const imagePath = path.join(__dirname, "../../public", "/certificate.jpg");

    doc.image(imagePath, 0, 0, { width: 1056, height: 816 });

    const name = user?.name || "User";
    const splitName = name.split(" ");
    const xIndex = splitName.length === 1 ? 450 : 400;

    doc
      .fillColor("#4486F4")
      .font("Helvetica-Bold")
      .fontSize(38)
      .text(name, xIndex, 276);

    doc
      .fillColor("#002C75")
      .font("Helvetica")
      .fontSize(30)
      .text(
        `${activePlan.plan_type} Video Editing along with Motion Graphics`,
        200,
        362.5
      );

    doc
      .fillColor("#4486F4")
      .font("Helvetica")
      .fontSize(17)
      .text(formatDateTime(new Date()), 502, 492);

    // Add the QR code to the PDF
    doc.image(qrCodeDataURL, 90, 658, {
      width: 70,
    });

    writeStream.on("finish", () => {
      fs.readFile(tempFilePath, async (err, data) => {
        if (err) {
          console.log("Error", data, err);
        } else {
          try {
            // Todo:Send email
            const attachments = [
              {
                filename: `certificate.pdf`,
                path: tempFilePath,
                content: data.toString("base64"),
                encoding: "base64",
              },
            ];

            await sendEmail({
              to: user.email,
              subject: "Certificate",
              html: "Testing certififcate",
              attachments,
            });

            fs.unlink(tempFilePath, (err) => {});
            resolve(data);
          } catch (error) {
            console.log(error);
            // res.status(400).send({ message: "something went wrong" });
            // reject({error:"Something went wrong"});
          }
        }
      });
    });

    // Finalize the PDF
    doc.end();
    doc.pipe(writeStream);
  });
};

const createCertificate = async ({ name, planId, userId, isAdmin }) => {
  if (!isAdmin && !name) throw new BadRequestError("Please provide name");
  if (!planId) throw new BadRequestError("Please enter plan id");

  const alreadyExistsPromise = CertificateModel.findOne({
    user: userId,
    plan: planId,
    isIssued: true,
  });

  const currentCertificatePromise = CertificateModel.findOne({
    user: userId,
    plan: planId,
    isIssued: false,
  });

  const userPromise = userModel.findById(userId).select("email name");

  const existingPlanPromise = PlanModel.findById(planId);

  let [alreadyExists, currentCertificate, existingPlan, user] =
    await Promise.all([
      alreadyExistsPromise,
      currentCertificatePromise,
      existingPlanPromise,
      userPromise,
    ]);

  if (!currentCertificate && alreadyExists) {
    throw new BadRequestError("Certificate already issued");
  }

  if (!isAdmin && !currentCertificate) {
    throw new BadRequestError(
      "Either course is not completed or assigments are pending"
    );
  }

  if (isAdmin) {
    const progressResult = await calculateProgress({
      user,
      activePlan: existingPlan,
      isAdmin: true,
    });

    const { progress, averageAssigmentsScore } = progressResult;

    if (currentCertificate) {
      currentCertificate.averageAssigmentsScore = averageAssigmentsScore;
      currentCertificate.totalAssignments = progress[0]?.totalAssignments;
      currentCertificate.scoresSum = progress[0]?.scoresSum || 0;
    } else {
      currentCertificate = await CertificateModel.create({
        user: userId,
        plan: existingPlan._id,
        averageAssigmentsScore,
        totalAssignments: progress[0]?.totalAssignments,
        scoresSum: progress[0]?.scoresSum,
      });
    }
  }

  user.name = name;
  const data = await createCertificateBuffer({
    user,
    averageAssigmentsScore: currentCertificate,
    activePlan: existingPlan,
    certificateId: currentCertificate._id,
  });

  const result = await s3Uploadv4(data, "certificates", "invoice");
  const certificatePath = result?.Key;

  let deletePreviousPromise = null;
  if (alreadyExists) {
    deletePreviousPromise = alreadyExists.deleteOne();
    // throw new BadRequestError("Certificate Already exists");
  }

  currentCertificate.path = certificatePath;
  currentCertificate.isIssued = true;
  const saveCurrentPromise = currentCertificate.save();

  await Promise.all([deletePreviousPromise, saveCurrentPromise]);
};

// By user
exports.generateMyCertificate = async (req, res) => {
  const { name } = req.body;
  const userId = req.user._id;

  const activeOrder = await OrderModel.findOne({
    user: userId,
    status: "Active",
  });

  if (!activeOrder) {
    throw new BadRequestError("No active plan found");
  }

  const planId = activeOrder?.plan;

  await createCertificate({
    name,
    planId,
    userId,
  });

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Certificate issued successfully",
  });
};

// TODO: By admin (Helper fun)
exports.generateUserCertificates = async ({ plans, user }) => {
  const createCertificatesPromises = [];

  plans.forEach((plan) => {
    const createPromise = createCertificate({
      name: user.name,
      planId: plan._id,
      userId: user._id,
      isAdmin: true,
    });

    createCertificatesPromises.push(createPromise);
  });

  await Promise.all(createCertificatesPromises);
};

exports.getCertificates = async (req, res) => {
  const userId = req.user._id;
  const certificates = await CertificateModel.find({
    user: userId,
    isIssued: true,
  }).select("path");

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Certificates fetched successfully",
    data: {
      certificates,
    },
  });
};

exports.verifyCertificate = async (req, res) => {
  const id = req.params.id;

  const existingCertificate = await CertificateModel.findOne({
    _id: id,
    isIssued: true,
  })
    .populate({
      path: "user",
      select: "name",
    })
    .lean();

  if (!existingCertificate) {
    throw new BadRequestError("This certificate is not valid");
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Certificate is valid",
    data: {
      certificate: appendBucketName(existingCertificate.path),
    },
  });
};

exports.leaderBoard = async (req, res) => {
  let { search, from, to, currentPage } = req.query;

  const query1 = {};
  search = search?.trim();
  if (search) {
    const searchRegExp = new RegExp(search, "i");
    query1.$or = [
      { "user.name": { $regex: searchRegExp } },
      { "user.email": { $regex: searchRegExp } },
    ];
  }

  const query2 = {};
  if (from || to) {
    query2.createdAt = {};
    if (from) query2.createdAt.$gte = new Date(from);
    if (to) {
      const endOfDay = new Date(to);
      // Includes whole day
      endOfDay.setHours(23, 59, 59, 999);
      query2.createdAt.$lte = endOfDay;
    }
  }

  const page = currentPage || 1;
  const limit = 8;
  const skip = (page - 1) * limit;

  const usersCompletedCourse = await CertificateModel.aggregate([
    {
      $match: query2,
    },
    {
      $sort: {
        averageAssigmentsScore: -1,
      },
    },
    {
      $skip: skip,
    },
    {
      $lookup: {
        from: "users",
        let: { userId: "$user" },

        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$_id", "$$userId"] },
            },
          },
          {
            $project: {
              name: 1,
              email: 1,
            },
          },
        ],

        as: "user",
      },
    },
    {
      $match: query1,
    },
    {
      $set: {
        user: { $arrayElemAt: ["$user", 0] },
      },
    },
    {
      $project: {
        user: 1,
        scoresSum: 1,
        averageAssigmentsScore: 1,
        createdAt: 1,
      },
    },
  ]);

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Leader board fetched successfully",
    data: {
      leaderBoard: usersCompletedCourse,
    },
  });
};
