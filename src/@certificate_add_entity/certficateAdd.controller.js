const { StatusCodes } = require("http-status-codes");

const CertficateAddModel = require("./certificateAdd.model.js");
const { NotFoundError } = require("../../errors/index.js");

// Add or update certificate
exports.createCertificateAdd = async (req, res) => {
  const { image, caption, key_points } = req.body;

  const certificate = await CertficateAddModel.findOne();

  if (certificate) {
    if (image) certificate.image = image;
    if (caption) certificate.caption = caption;
    if (key_points) certificate.key_points = key_points;
    await certificate.save();
  }

  await CertficateAddModel.create({ image, caption, key_points });

  const statusCode = certificate ? StatusCodes.OK : StatusCodes.CREATED;
  const message = certificate
    ? "Certificate updated successfully"
    : "Certificate created successfully";

  res.status(statusCode).json({
    success: true,
    message: message,
  });
};

exports.getCertificateAdd = async (req, res) => {
  const certificate = await CertficateAddModel.findOne().lean();
  res.status(StatusCodes.OK).json({
    success: true,
    data: { certificate },
    message: "Certificate fetch successfully",
  });
};

// Delete certificate
exports.deleteCertificateAdd = async (req, res) => {
  const certificate = await CertficateAddModel.deleteMany();
  if (!certificate) {
    throw new NotFoundError("Certificate not found");
  }

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: "Certificate deleted successfully",
  });
};
