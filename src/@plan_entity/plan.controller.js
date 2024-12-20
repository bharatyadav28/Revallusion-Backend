const { StatusCodes } = require("http-status-codes");

const PlanModel = require("./plan.model.js");
const { NotFoundError } = require("../../errors/index.js");

// Add a plan
exports.addPlan = async (req, res) => {
  const { plan_type, inr_price, validity } = req.body;
  const plan = await PlanModel.create({ plan_type, inr_price, validity });

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: "Plan created Successfully",
  });
};

// Get all plans
exports.getPlans = async (req, res) => {
  const plans = await PlanModel.find().lean();

  res.status(StatusCodes.OK).json({
    success: true,
    data: { plans, count: plans.length },
    message: "Plans fetch successfully",
  });
};

// Get a single plan
exports.getPlan = async (req, res, next) => {
  const plan = await PlanModel.findById(req.params.id);
  if (!plan) {
    throw new NotFoundError("Plan not found");
  }
  res.status(StatusCodes.OK).json({
    success: true,
    data: { plan },
    message: "Plan fetch successfully",
  });
};

// Update a plan
exports.updatePlan = async (req, res, next) => {
  const plan = await PlanModel.findById(req.params.id);
  const { inr_price } = req.body;
  if (!plan) {
    throw new NotFoundError("Plan not found");
  }
  if (inr_price) plan.inr_price = inr_price;
  await plan.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Plan updated successfully",
  });
};

// Delete a plan
exports.deletePlan = async (req, res, next) => {
  const plan = await PlanModel.findByIdAndDelete(req.params.id);
  if (!plan) {
    throw new NotFoundError("Plan not found");
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Plan deleted successfully",
  });
};
