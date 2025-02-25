const mongoose = require("mongoose");
const path = require("path");
const { StatusCodes } = require("http-status-codes");

const { NotFoundError, BadRequestError } = require("../../errors");
const SubmittedAssignmentModel = require("./submitted_assignment.model");
const AssignmentModel = require("../@assignment_entity/assignment.model");
const CourseModel = require("../@course_entity/course.model");
const {
  extractURLKey,
  awsUrl,
  appendBucketName,
} = require("../../utils/helperFuns");
const { s3Uploadv4 } = require("../../utils/s3");

exports.uploadAssignmentAnswer = async (req, res) => {
  // Upload image or document file only

  if (!req.file) {
    throw new BadRequestError("Please upload a file");
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  if (ext !== ".rar") {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: "Invalid file type. Only .rar files are allowed!" });
  }

  // Validate file size
  if (req.file.size > 50 * 1024 * 1024) {
    throw new BadRequestError("File size should be less than 50MB");
  }

  // Get file type
  result = await s3Uploadv4(req.file, req.user._id);

  return res.status(StatusCodes.OK).json({
    success: true,
    data: { fileUrl: appendBucketName(result.key) },
    message: "File uploaded successfully",
  });
};

exports.submitAssignment = async (req, res) => {
  const { submittedFileUrl, videoId } = req.body;

  if (!videoId) throw new BadRequestError("Please enter video id");
  if (!submittedFileUrl)
    throw new BadRequestError("Please enter submitted file url");

  const user = req.user._id;

  const filePath = extractURLKey(submittedFileUrl);

  const assignment = await SubmittedAssignmentModel.create({
    video: videoId,
    user,
    submittedFileUrl: filePath,
  });

  if (!assignment) {
    throw new BadRequestError("Assignment not submitted");
  }

  return res.status(StatusCodes.CREATED).json({
    success: true,
    message: "Assignment submitted successfully",
  });
};

// Update assignment score
exports.updateScore = async (req, res) => {
  const { id } = req.params;
  const { score } = req.body;

  const assignment = await SubmittedAssignmentModel.findOneAndUpdate(
    { _id: id },
    { score, gradedAt: Date.now() }
  );
  if (!assignment) {
    throw new NotFoundError("Assignment not found");
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Assignment updated successfully",
  });
};

// Get submitted assignments by course
exports.getSubmittedAssignments = async (req, res) => {
  const { id: courseId } = req.params;

  // Filter params
  const { moduleId, submoduleId, isGraded, resultPerPage, currentPage } =
    req.query;

  // Filter assignments based on course, module and submodule
  const query = {
    course: courseId,
  };
  if (moduleId) query.module = moduleId;
  if (submoduleId) query.submodule = submoduleId;

  const allAssignments = await AssignmentModel.find(query).select("_id");

  let query2 = {
    assignment: {
      $in: allAssignments.map((assignment) => assignment._id),
    },
    isRevoked: false,
  };

  // Filter submitted assignments based on graded or not
  if (isGraded && isGraded === "yes") query2.score = { $gte: 0 };
  if (isGraded && isGraded === "no") query2.score = null;

  const limit = Number(resultPerPage) || 8;
  const page = Number(currentPage) || 1;
  const skip = (page - 1) * limit;

  const submittedAssignmentsPromise = SubmittedAssignmentModel.aggregate([
    {
      $match: query2,
    },
    {
      // Recent submission on top
      $sort: {
        submittedAt: -1,
      },
    },
    {
      $skip: skip,
    },
    {
      $limit: limit,
    },
    {
      // Submitted user details
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "user",

        pipeline: [
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
      // convert array to obj(single element)
      $unwind: "$user",
    },
    {
      // Fetch assignment details
      $lookup: {
        from: "assignments",
        foreignField: "_id",
        localField: "assignment",

        pipeline: [
          {
            // Fetch module details , assignment belongs to
            $lookup: {
              from: "coursemodules",
              foreignField: "_id",
              localField: "module",

              pipeline: [
                {
                  $project: {
                    name: 1,
                  },
                },
              ],

              as: "module",
            },
          },
          {
            $unwind: "$module",
          },
          {
            // Fetch submodule details , assignment belongs to

            $lookup: {
              from: "submodules",
              foreignField: "_id",
              localField: "submodule",

              pipeline: [
                {
                  $project: {
                    name: 1,
                  },
                },
              ],
              as: "submodule",
            },
          },
          {
            $unwind: "$submodule",
          },

          {
            $project: {
              module: 1,
              submodule: 1,
              name: 1,
            },
          },
        ],
        as: "assignment",
      },
    },
    {
      // convert array to obj(single element)
      $unwind: "$assignment",
    },

    {
      // Fetch revoked submissions for same assignment and user
      $lookup: {
        from: "submittedassignments",
        let: {
          // Variables storing submitted assignment user and assignment id
          userId: "$user._id",
          assignmentId: "$assignment._id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: ["$user", "$$userId"],
                  },
                  {
                    $eq: ["$assignment", "$$assignmentId"],
                  },
                  {
                    $eq: ["$isRevoked", true],
                  },
                ],
              },
            },
          },
          {
            // Includes required field
            $project: {
              submittedFileUrls: 1,
              _id: 0,
            },
          },
          {
            // Convert array to single element
            $unwind: "$submittedFileUrls",
          },
          {
            // Rename submittedFileUrls to url
            $replaceRoot: {
              newRoot: { url: "$submittedFileUrls" },
            },
          },
        ],
        as: "revokedSubmissions",
      },
    },
    {
      // Convert revokedSubmissions (mutliple url objects)  to contain only url strings
      $addFields: {
        revokedSubmissions: {
          $map: {
            input: "$revokedSubmissions",
            as: "submission",
            in: {
              $concat: [awsUrl, "/", "$$submission.url"],
            },
          },
        },
        submittedFileUrls: {
          $map: {
            input: "$submittedFileUrls",
            as: "url",
            in: {
              $concat: [awsUrl, "/", "$$url"],
            },
          },
        },
      },
    },
  ]);

  // Fetch submodules of this course for filtering
  const submodulesPromise = CourseModel.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(courseId),
      },
    },

    {
      $lookup: {
        from: "coursemodules",
        localField: "_id",
        foreignField: "course",
        as: "modules",
      },
    },
    {
      $unwind: "$modules",
    },
    {
      $lookup: {
        from: "submodules",
        localField: "modules._id",
        foreignField: "module",
        as: "submodules",
      },
    },
    {
      $unwind: "$submodules",
    },
    {
      $project: {
        _id: 0,
        value: `$submodules._id`,
        key: `$submodules.name`,
      },
    },
  ]);

  const submittedAssignmentsCountPromise =
    SubmittedAssignmentModel.countDocuments(query2);

  const [submittedAssignments, submodules, submittedAssignmentsCount] =
    await Promise.all([
      submittedAssignmentsPromise,
      submodulesPromise,
      submittedAssignmentsCountPromise,
    ]);

  const pagesCount = Math.ceil(submittedAssignmentsCount / limit) || 1;

  return res.status(StatusCodes.OK).json({
    success: true,
    data: { submittedAssignments, submodules, pagesCount },
    message: "Assignments fetch successfully",
  });
};

// revoke submitted assignments
exports.revokeAssignment = async (req, res) => {
  const { id } = req.params;

  const result = await SubmittedAssignmentModel.updateOne(
    {
      _id: id,
    },
    {
      isRevoked: true,
    },
    { runValidators: true }
  );
  // Handle case when no document is found
  if (result.matchedCount === 0) {
    throw new NotFoundError("Assignment not found");
  }

  // Handle case when update did not modify any document
  if (result.modifiedCount === 0) {
    throw new BadRequestError("Assignment revokation failed");
  }

  return res.status(StatusCodes.OK).json({
    succes: true,
    message: "Revoked successfully",
  });
};
