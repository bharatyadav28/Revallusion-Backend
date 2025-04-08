const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const { StatusCodes } = require("http-status-codes");

const CertificateModel = require("./certificate.model");
const OrderModel = require("../@order_entity/order.model");
const PlanModel = require("../@plan_entity/plan.model.js");
const CourseModel = require("../@course_entity/course.model");
const VideoModel = require("../@video_entity/video.model.js");
const { BadRequestError, NotFoundError } = require("../../errors/index.js");

// Test
exports.createCertfifcate = async (req, res) => {
  const tempFilePath = path.join("test", `certficate.pdf`);

  const doc = new PDFDocument({
    size: "A4", // Standard A4 size
    margins: { top: 30, left: 30, right: 30, bottom: 30 }, // Outer margins
  });

  const writeStream = fs.createWriteStream(tempFilePath);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = 50; // Margin from outer div

  // Outer Div (Full Page)
  doc.rect(0, 0, pageWidth, pageHeight).fill("#FFF");

  // Inner Div (with some margin)
  const innerX = margin;
  const innerY = margin;
  const innerWidth = pageWidth - 2 * margin;
  const innerHeight = pageHeight - 2 * margin;

  doc.fillColor("#F2EEEB").rect(innerX, innerY, innerWidth, innerHeight).fill();

  // Adding some text inside the inner div
  doc
    .fillColor("black")
    .fontSize(20)
    .text("This is the my inner Div", innerX + 20, innerY + 20);

  doc
    .save() // Save the current state

    .moveTo(100, 200) // Starting point (x, y)
    .lineTo(200, 100) // Draw to second point
    .lineTo(300, 200) // Draw to third point
    .lineTo(100, 200) // Close the triangle
    .fill("#ff5733") // Background color (fill)

    .restore();

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

  if (!isAdmin && inCompleteVideos > 0) {
    const errorText =
      inCompleteVideos === 1 ? "1 video is" : `${inCompleteVideos} videos  are`;
    throw new BadRequestError(`${errorText} not complete`);
  }

  if (!isAdmin && unGradedAssignments > 0) {
    const errorText =
      unGradedAssignments === 1
        ? "1 assignment is"
        : `${inCompleteVideos} assignments  are`;
    throw new BadRequestError(
      `${errorText} either not submitted by you or not graded by mentor`
    );
  }

  let averageAssigmentsScore = 0;

  if (totalAssignments > 0) {
    averageAssigmentsScore = (scoresSum / totalAssignments).toFixed(2);
  }

  const certificate = await CertificateModel.create({
    plan: activePlan._id,
    user,
    path: "/test",
  });

  if (!certificate) {
    throw new BadRequestError("Certificate creation failed");
  }

  return {
    progress,
    averageAssigmentsScore,
  };
};

// By user
exports.generateMyCertificate = async (req, res) => {
  const { name } = req.body;

  const userId = req.user._id;

  const activeOrder = await OrderModel.findOne({
    user: userId,
    status: "Active",
  }).populate({
    path: "plan",
    select: "plan_type level",
  });
  if (!activeOrder) {
    throw new NotFoundError("You don't have any active plan");
  }

  const activePlan = activeOrder.plan;

  const user = req.user;
  user.name = name;

  const result = await calculateProgress({
    user,
    activePlan,
    isAdmin: false,
  });

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Certificate created successfully",
    data: {
      ...result,
    },
  });
};

// By admin (Helper fun)
exports.generateUserCertificates = async ({ plans, user }) => {
  const progressPromises = [];

  plans?.forEach((plan) => {
    const promise = calculateProgress({
      user,
      activePlan: plan,
      isAdmin: true,
    });
    progressPromises.push(promise);
  });

  const progress = await Promise.all(progressPromises);

  console.log("Progress", progress);
  return progress;
};

exports.getCertificates = async (req, res) => {
  const userId = req.user._id;
  const certificates = await CertificateModel.find({
    user: userId,
  });

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Certificates fetched successfully",
    data: {
      certificates,
    },
  });
};
