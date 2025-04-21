const { StatusCodes } = require("http-status-codes");

const AppConfigModel = require("./app_config.model");
const { BadRequestError, NotFoundError } = require("../../errors/index");

exports.getActiveGateways = async (req, res) => {
  const appConfigs = await AppConfigModel.findOne()
    .select("activeGateways")
    .lean();

  if (!appConfigs?.activeGateways) {
    throw new NotFoundError("No active gateway found");
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Active gateways fetched successfully",
    data: {
      activeGateways: appConfigs.activeGateways,
    },
  });
};

exports.updateActiveGateway = async (req, res) => {
  const { gateways } = req.body;

  if (!gateways || gateways.length === 0) {
    throw new BadRequestError("Please select altleast one gateway");
  }

  const result = await AppConfigModel.findOneAndUpdate(
    {},
    {
      $set: { activeGateways: gateways },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
    }
  );

  if (!result) {
    throw new BadRequestError("Error in updating active gateway");
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Active gateway updated successfully",
  });
};
