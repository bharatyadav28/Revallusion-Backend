const { StatusCodes } = require("http-status-codes");

const CarousalModel = require("./carousal.model.js");
const { NotFoundError } = require("../../errors/index.js");

// Add a carousal
exports.addCarousalData = async (req, res) => {
  const { sequence, caption, description, key_points } = req.body;
  await CarousalModel.create({
    sequence,
    caption,
    description,
    key_points,
  });

  return res.status(StatusCodes.CREATED).json({
    success: true,
    message: "Carousal Created Successfully",
  });
};

// Get all carousals
exports.getCarousals = async (req, res) => {
  const carousals = await CarousalModel.find({}).sort({ createdAt: -1 });

  return res
    .status(StatusCodes.OK)
    .json({ success: true, data: { carousals, count: carousals.length } });
};

// Get single carousals
exports.getCarousal = async (req, res) => {
  const id = req.params.id;
  const carousal = await CarousalModel.findById(id);

  if (!carousal) {
    throw new NotFoundError("Carousal not found");
  }

  return res.status(StatusCodes.OK).json({ success: true, data: { carousal } });
};

// Update a carousal
exports.updateCarousal = async (req, res) => {
  const id = req.params.id;
  const { sequence, caption, description, key_points } = req.body;
  const carousal = await CarousalModel.findByIdAndUpdate(
    id,
    { sequence, caption, description, key_points },
    { new: true }
  );

  if (!carousal) {
    throw new NotFoundError("Carousal not found");
  }

  return res
    .status(StatusCodes.OK)
    .json({ success: true, message: "Carousal Updated Successfully" });
};

// Delete a carousal
exports.deleteCarousal = async (req, res) => {
  const id = req.params.id;
  const carousal = await CarousalModel.findByIdAndDelete(id);

  if (!carousal) {
    throw new NotFoundError("Carousal not found");
  }

  return res
    .status(StatusCodes.OK)
    .json({ success: true, message: "Carousal Deleted Successfully" });
};
