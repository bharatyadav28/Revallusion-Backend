const mongoose = require("mongoose");

const CertificateSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "Please enter user id"],
  },
  path: {
    type: String,
    trim: true,
    required: [true, "Please enter certificate path "],
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Plan",
    required: [true, "Please enter plan id"],
  },
});

const CertificateModel = mongoose.model("Certificate", CertificateSchema);

// Static methods

// CertificateModel.statics.calculateProgress = async function ({
//   user,
//   activePlanLevel,
//   isAdmin,
// }) {
//   const userId = user?._id;
//   let coveredCourseIds = [];

//   // Fetch all course ids eligible under current plan
//   if (activePlanLevel >= 1) {
//     const [coveredCourses] = await PlanModel.aggregate([
//       {
//         $match: {
//           level: {
//             $lte: activePlanLevel,
//           },
//         },
//       },
//       {
//         $lookup: {
//           from: "courses",
//           foreignField: "plan",
//           localField: "_id",
//           as: "course",
//           pipeline: [
//             {
//               $project: {
//                 _id: 1,
//               },
//             },
//           ],
//         },
//       },
//       {
//         $unwind: { path: "$course", preserveNullAndEmptyArrays: true },
//       },
//       {
//         $group: {
//           _id: null,
//           courseIds: { $push: "$course._id" },
//         },
//       },
//       {
//         $project: {
//           courseIds: 1,
//           _id: 0,
//         },
//       },
//     ]);

//     coveredCourseIds = coveredCourses?.courseIds || [];
//   }

//   const progress = await VideoModel.aggregate([
//     {
//       $match: {
//         course: {
//           $in: coveredCourseIds,
//         },
//       },
//     },
//     {
//       $lookup: {
//         from: "videoprogresses",
//         let: { videoId: "$_id" },
//         pipeline: [
//           {
//             $match: {
//               $expr: {
//                 $and: [
//                   { $eq: ["$video", "$$videoId"] },
//                   { $eq: ["$user", userId] },
//                 ],
//               },
//             },
//           },
//           {
//             $project: {
//               isCompleted: 1,
//             },
//           },
//         ],
//         as: "videoProgress",
//       },
//     },

//     {
//       $lookup: {
//         from: "submittedassignments",
//         let: { videoId: "$_id" },
//         pipeline: [
//           {
//             $match: {
//               $expr: {
//                 $and: [
//                   { $eq: ["$video", "$$videoId"] },
//                   { $eq: ["$user", userId] },
//                   { $eq: ["$isRevoked", false] },
//                 ],
//               },
//             },
//           },
//           {
//             $project: {
//               score: 1,
//             },
//           },
//         ],
//         as: "submittedAssignment",
//       },
//     },
//     {
//       $set: {
//         isCompleted: {
//           $ifNull: [
//             {
//               $arrayElemAt: ["$videoProgress.isCompleted", 0],
//             },
//             false,
//           ],
//         },
//         assignmentScore: {
//           $ifNull: [
//             {
//               $arrayElemAt: ["$submittedAssignment.score", 0],
//             },
//             null,
//           ],
//         },
//       },
//     },
//     {
//       $group: {
//         _id: null,
//         // videos: { $push: "$$ROOT" },
//         inCompleteVideos: { $sum: { $cond: ["$isCompleted", 0, 1] } },
//         totalAssignments: {
//           $sum: { $cond: [{ $ifNull: ["$assignment", false] }, 1, 0] },
//         },
//         scoresSum: {
//           $sum: { $ifNull: ["$assignmentScore", 0] },
//         },
//         unGradedAssignments: {
//           $sum: { $cond: [{ $ifNull: ["$assignmentScore", 0] }, 0, 1] },
//         },
//       },
//     },
//   ]);

//   if (!progress.length) {
//     throw new BadRequestError("No progress found for enrolled courses");
//   }
//   const { inCompleteVideos, totalAssignments, scoresSum, unGradedAssignments } =
//     progress[0];

//   if (!isAdmin && inCompleteVideos > 0) {
//     const errorText =
//       inCompleteVideos === 1 ? "1 video is" : `${inCompleteVideos} videos  are`;
//     throw new BadRequestError(`${errorText} not complete`);
//   }

//   if (!isAdmin && unGradedAssignments > 0) {
//     const errorText =
//       unGradedAssignments === 1
//         ? "1 assignment is"
//         : `${inCompleteVideos} assignments  are`;
//     throw new BadRequestError(
//       `${errorText} either not submitted by you or not graded by mentor`
//     );
//   }

//   let averageAssigmentsScore = 0;

//   if (totalAssignments > 0) {
//     averageAssigmentsScore = (scoresSum / totalAssignments).toFixed(2);
//   }

//   return {
//     progress,
//     averageAssigmentsScore,
//   };
// };

module.exports = CertificateModel;
