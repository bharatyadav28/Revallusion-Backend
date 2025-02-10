const { StatusCodes } = require("http-status-codes");

const { NotFoundError, BadRequestError } = require("../../errors");
const AssignmentModel = require("./assignment.model");
const SubmoduleModel = require("../@submodule_entity/submodule.model");
const OrderModel = require("../@order_entity/order.model");
const { awsUrl, extractURLKey } = require("../../utils/helperFuns");
const { default: mongoose } = require("mongoose");
const CourseModel = require("../@course_entity/course.model");

// Get all submoodule assignments
exports.getSubmoduleAssignments = async (req, res) => {
  const { submoduleId } = req.params;
  // const assignments = await AssignmentModel.find({
  //   submodule: submoduleId,
  // });

  const assignments = await AssignmentModel.aggregate([
    {
      $match: {
        submodule: new mongoose.Types.ObjectId(submoduleId),
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        fileUrl: {
          $concat: [awsUrl, "/", "$fileUrl"],
        },
        createdAt: 1,
      },
    },
  ]);

  res.status(StatusCodes.OK).json({
    success: true,
    data: { assignments },
  });
};

// Create a new assignments for submodule
exports.addAssignment = async (req, res) => {
  const { name, fileUrl, submoduleId, courseId, moduleId } = req.body;

  const submodule = await SubmoduleModel.findById(submoduleId);
  if (!submodule) {
    throw new NotFoundError("Targeted submodule doesnot exist");
  }

  const filePath = extractURLKey(fileUrl);

  const assignment = await AssignmentModel.create({
    name,
    fileUrl: filePath,
    course: courseId,
    module: moduleId,
    submodule: submoduleId,
  });
  if (!assignment) {
    throw new BadRequestError("Assignment not created");
  }

  return res.status(StatusCodes.CREATED).json({
    success: true,
    message: "Assignment created Successfully",
  });
};

// Update an assignment
exports.updateAssignment = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name) {
    throw new NotFoundError("Please provide assignment name");
  }

  const assignment = await AssignmentModel.findOneAndUpdate(
    { _id: id },
    { name }
  );
  if (!assignment) {
    throw new NotFoundError("Assignment not found");
  }
  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Assignment updated successfully",
  });
};

// Delete an assignment
exports.deleteAssignment = async (req, res) => {
  const { id } = req.params;
  const assignment = await AssignmentModel.findByIdAndDelete(id);
  if (!assignment) {
    throw new NotFoundError("Assignment not found");
  }
  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Assignment deleted successfully",
  });
};

//TODO: Get all assignments based on plan purchased
exports.getSubscriptionAssignments = async (req, res) => {
  const user = req.user._id;

  const { planId } = req.params;
  const orderPromise = OrderModel.findOne({
    user: user,
    plan: planId,
    status: "Active",
  });

  const coursePromise = CourseModel.findOne({
    plan: planId,
  });

  const [order, course] = await Promise.all([orderPromise, coursePromise]);

  if (order) {
    const courseId = course._id;

    const assignments = await AssignmentModel.aggregate([
      {
        $match: {
          course: courseId,
        },
      },
      {
        $group: {
          _id: "$module",
          moduleId: { $first: "$module" },

          assignments: {
            $push: {
              _id: "$_id",
              name: "$name",
              fileUrl: awsUrl + "/" + "$fileUrl",
            },
          },
        },
      },
      {
        $lookup: {
          from: "coursemodules", // The modules collection
          localField: "_id",
          foreignField: "_id",
          as: "moduleDetails",
        },
      },
      {
        $unwind: "$moduleDetails",
      },
      {
        $project: {
          _id: 0, // Remove default _id
          moduleId: 1, // Keep module ID
          moduleName: "$moduleDetails.name", // Extract module name
          assignments: 1,
        },
      },
    ]);

    return res.status(StatusCodes.OK).json({
      success: true,
      data: { assignments },
    });
  }

  res.status(StatusCodes.OK).json({
    success: true,
    data: { assignments: "No assignments" },
  });
};
