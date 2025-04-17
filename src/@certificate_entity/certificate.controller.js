const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const { StatusCodes } = require("http-status-codes");

const CertificateModel = require("./certificate.model");
const OrderModel = require("../@order_entity/order.model");
const PlanModel = require("../@plan_entity/plan.model.js");
const CourseModel = require("../@course_entity/course.model");
const VideoModel = require("../@video_entity/video.model.js");
const { BadRequestError, NotFoundError } = require("../../errors/index.js");
const { s3Uploadv4 } = require("../../utils/s3.js");
const sendEmail = require("../../utils/sendEmail");
const userModel = require("../@user_entity/user.model.js");

// Test
exports.createCertfifcateTest = async (req, res) => {
  const tempFilePath = path.join("test", `certficate.pdf`);

  const doc = new PDFDocument({
    size: [1056, 816], // Width and height in points (1 point ≈ 1 px here)
  });

  const writeStream = fs.createWriteStream(tempFilePath);

  const imagePath = path.join(__dirname, "../../public", "/certificate.jpg");

  doc.image(imagePath, 0, 0, { width: 1056, height: 816 });

  doc.font("Times-Roman");

  doc
    .fillColor("#000000") // Default color for most text
    .opacity(0.65)
    .fontSize(25)
    .text("This certificate is proudly presented to ", 140, 290, {
      continued: true,
      lineGap: 8,
    })
    .opacity(1)
    .text("Ravali Kandregula", { continued: true })
    .opacity(0.65)
    .text(" for successfully completing the ", { continued: true })
    .fillColor("#4486F4")
    .opacity(1) // Default color for most text
    .text("Advance Video Editing along with Motion Graphics ", {
      continued: true,
    })
    .fillColor("#000000")
    .opacity(0.65)
    .text("offered by ", { continued: true })
    .opacity(1)
    .text("Ravallusion Academy.", { continued: true })
    .opacity(0.7)
    .text(
      "We thank you for your exceptional efforts and wish you the best of luck in your future."
    );

  doc
    .fillColor("#000000") // Default color for most text
    .opacity(0.65)
    .fontSize(18)
    .text("Issued on: ", 400, 470, {
      continued: true,
    })
    .opacity(1)
    .text("October 18, 2022");

  // Finalize the PDF
  doc.end();
  doc.pipe(writeStream);

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Certificate created successfully",
  });
};

const createCertificateBuffer = async ({
  user,
  averageAssigmentsScore,
  activePlan,
}) => {
  return new Promise((resolve, reject) => {
    const tempFilePath = path.join("/tmp", `${user._id}.pdf`);

    const doc = new PDFDocument({
      size: [1056, 816], // Width and height in points (1 point ≈ 1 px here)
    });

    const writeStream = fs.createWriteStream(tempFilePath);

    const imagePath = path.join(__dirname, "../../public", "/certificate.jpg");

    doc.image(imagePath, 0, 0, { width: 1056, height: 816 });

    doc.font("Times-Roman");

    doc
      .fillColor("#000000")
      .opacity(0.65)
      .fontSize(25)
      .text("This certificate is proudly presented to ", 140, 290, {
        continued: true,
        lineGap: 8,
      })
      .opacity(1)
      .text(`${user?.name || User} `, { continued: true })
      .opacity(0.65)
      .text(`for successfully completing the `, {
        continued: true,
      })
      .fillColor("#4486F4")
      .opacity(1)
      .text(
        `${activePlan.plan_type} Video Editing along with Motion Graphics `,
        {
          continued: true,
        }
      )
      .fillColor("#000000")
      .opacity(0.65)
      .text("offered by ", { continued: true })
      .opacity(1)
      .text("Ravallusion Academy. ", { continued: true })
      .opacity(0.7)
      .text(
        "We thank you for your exceptional efforts and wish you the best of luck in your future."
      );

    doc
      .fillColor("#000000")
      .opacity(0.65)
      .fontSize(18)
      .text("Issued on: ", 400, 470, {
        continued: true,
      })
      .opacity(1)
      .text("October 18, 2022");

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

            console.log("user", user);

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

const createCertififcate = async ({
  user,
  totalAssignments,
  scoresSum,
  averageAssigmentsScore,
  activePlan,
}) => {
  const data = await createCertificateBuffer({
    user,
    averageAssigmentsScore,
    activePlan,
  });

  const result = await s3Uploadv4(data, "certificates", "invoice");
  const certificatePath = result?.Key;

  return certificatePath;
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

  if (!isAdmin && (inCompleteVideos > 0 || unGradedAssignments > 0)) {
    return {
      progress: null,
      averageAssigmentsScore: null,
    };
  }

  // if (!isAdmin && inCompleteVideos > 0) {
  //   const errorText =
  //     inCompleteVideos === 1 ? "1 video is" : `${inCompleteVideos} videos  are`;
  //   throw new BadRequestError(`${errorText} not complete`);
  // }

  // if (!isAdmin && unGradedAssignments > 0) {
  //   const errorText =
  //     unGradedAssignments === 1
  //       ? "1 assignment is"
  //       : `${inCompleteVideos} assignments  are`;
  //   throw new BadRequestError(
  //     `${errorText} either not submitted by you or not graded by mentor`
  //   );
  // }

  let averageAssigmentsScore = 0;

  if (totalAssignments > 0) {
    averageAssigmentsScore = (scoresSum / totalAssignments).toFixed(2);
  }

  // const certificate = await CertificateModel.create({
  //   plan: activePlan._id,
  //   user,
  //   path: "/test",
  // });

  // if (!certificate) {
  //   throw new BadRequestError("Certificate creation failed");
  // }

  return {
    progress,
    averageAssigmentsScore,
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

    const { progress, averageAssigmentsScore } = await calculateProgress({
      user,
      activePlan,
      isAdmin: false,
    });

    if (progress && averageAssigmentsScore) {
      await CertificateModel.create({
        user: userId,
        plan: activePlan,
        averageAssigmentsScore,
        totalAssignments: progress[0].totalAssignments,
        scoresSum: progress[0].scoresSum,
      });
    }
  }
};

// By user
exports.generateMyCertificate = async (req, res) => {
  const { name, planId } = req.body;
  const userId = req.user._id;

  if (!name) throw new BadRequestError("Please provide name");
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

  // console.log("cuetrent pto", currentCertificatePromise);

  const existingPlanPromise = PlanModel.findById(planId);

  const [alreadyExists, currentCertificate, existingPlan, user] =
    await Promise.all([
      alreadyExistsPromise,
      currentCertificatePromise,
      existingPlanPromise,
      userPromise,
    ]);

  if (!currentCertificate && alreadyExists) {
    throw new BadRequestError("Certificate already issued");
  }

  if (!currentCertificate) {
    throw new BadRequestError("Please complete the course first");
  }

  const certificatePath = await createCertififcate({
    user,
    totalAssignments: currentCertificate.totalAssignments,
    scoresSum: currentCertificate.scoresSum,
    averageAssigmentsScore: currentCertificate.averageAssigmentsScore,
    activePlan: existingPlan,
  });

  let deletePreviousPromise = null;
  if (alreadyExists) {
    deletePreviousPromise = alreadyExists.deleteOne();
    // throw new BadRequestError("Certificate Already exists");
  }

  currentCertificate.path = certificatePath;
  currentCertificate.isIssued = true;
  const saveCurrentPromise = currentCertificate.save();

  await Promise.all([deletePreviousPromise, saveCurrentPromise]);

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Certificate issued successfully",
  });
};

// TODO: By admin (Helper fun)
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

  const progresses = await Promise.all(progressPromises);

  console.log("Progress", progresses);
  const createCertfificatePromises = [];
  // progresses.forEach(async(progress)=>{
  //   if (progress && averageAssigmentsScore) {
  //     await CertificateModel.create({
  //       user: user._id,
  //       plan: activePlan,
  //       averageAssigmentsScore,
  //       totalAssignments: progress[0].totalAssignments,
  //       scoresSum: progress[0].scoresSum,
  //     });
  //   }
  // })

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

  const query2 = { isIssued: true };
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
        averageAssigmentsScore: 1,
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
