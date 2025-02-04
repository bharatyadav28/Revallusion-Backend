const { StatusCodes } = require("http-status-codes");

const { NotFoundError, BadRequestError } = require("../../errors");
const AssignmentModel = require("./assignment.model");
const SubmoduleModel = require("../@submodule_entity/submodule.model");

// Get all submoodule assignments
exports.getSubmoduleAssignments = async (req, res) => {
  const { submoduleId } = req.params;
  const assignments = await AssignmentModel.find({
    submodule: submoduleId,
  });

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

  const assignment = await AssignmentModel.create({
    name,
    fileUrl,
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
