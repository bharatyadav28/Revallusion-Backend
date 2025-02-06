const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");

const { NotFoundError, BadRequestError } = require("../../errors");
const SubmittedAssignmentModel = require("./submitted_assignment.model");
const SubmoduleModel = require("../@submodule_entity/submodule.model");
const CourseModuleModel = require("../@course_module_entity/course_module.model");
const AssignmentModel = require("../@assignment_entity/assignment.model");

exports.submitAssignment = async (req, res) => {
  const { submittedFileUrls, assignmentId } = req.body;
  const user = req.user._id;

  const assignment = await SubmittedAssignmentModel.create({
    assignment: assignmentId,
    user,
    submittedFileUrls,
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
  const { moduleId, subModuleId, isGraded } = req.query;

  // Filter assignments based on course, module and submodule
  const query = {
    course: courseId,
  };
  if (moduleId) query.module = moduleId;
  if (subModuleId) query.submodule = subModuleId;

  const allAssignments = await AssignmentModel.find(query).select("_id");

  // Filter submitted assignments based on graded or not
  let query2 = {
    assignment: { $in: allAssignments.map((assignment) => assignment._id) },
  };
  if (isGraded && isGraded === "yes") query2.score = { $gte: 0 };
  if (isGraded && isGraded === "no") query2.score = null;

  const submittedAssignments = await SubmittedAssignmentModel.find(query2)
    .sort({ submittedAt: -1 })
    .populate([
      {
        path: "assignment",
        select: "name module submodule",
        populate: [
          {
            path: "module",
            select: "name",
          },
          {
            path: "submodule",
            select: "name",
          },
        ],
      },
      { path: "user", select: "name email" },
    ]);

  return res.status(StatusCodes.OK).json({
    success: true,
    data: { submittedAssignments },
    message: "Assignments fetch successfully",
  });
};
