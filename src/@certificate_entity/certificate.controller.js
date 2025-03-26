const { StatusCodes } = require("http-status-codes");

const CertificateModel = require("./certificate.model");
const OrderModel = require("../@order_entity/order.model");
const CourseModel = require("../@course_entity/course.model");
const { BadRequestError, NotFoundError } = require("../../errors/index.js");
const { default: mongoose } = require("mongoose");

exports.createCertificate = async (req, res) => {
  const userId = req.user._id;

  const activeOrder = await OrderModel.findOne({
    user: userId,
    status: "Active",
  }).populate({
    path: "plan",
    select: "plan_type",
  });
  if (!activeOrder) {
    throw new NotFoundError("You don't have any active plan");
  }

  const activePlanId = activeOrder.plan._id;

  const [progress] = await CourseModel.aggregate([
    {
      $match: { plan: new mongoose.Types.ObjectId(activePlanId) },
    },
    {
      $lookup: {
        from: "videos",
        let: { courseId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$course", "$$courseId"] },
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
            $set: {
              isCompleted: {
                $ifNull: [
                  {
                    $arrayElemAt: ["$videoProgress.isCompleted", 0],
                  },
                  false,
                ],
              },
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
                    gradedAt: 1,
                  },
                },
              ],
              as: "assignment",
            },
          },
          {
            $set: {
              isAssignmentGraded: {
                $gt: [
                  {
                    $arrayElemAt: ["$assignment.gradedAt", 0],
                  },
                  null,
                ],
              },
            },
          },

          {
            $project: {
              title: 1,
              isCompleted: 1,
              isAssignmentGraded: 1,
            },
          },
        ],
        as: "videos",
      },
    },
    {
      $project: {
        videos: 1,
        _id: 0,
      },
    },
  ]);

  progress?.forEach((video) => {
    if (!video.isCompleted) {
      throw new BadRequestError(
        "Please complete all videos to get certificate"
      );
    } else if (!video.isAssignmentGraded) {
      throw new BadRequestError(
        "All assignments may not be submitted or graded by mentor"
      );
    }
  });

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Certificate created successfully",
    data: {
      progress,
    },
  });
};
