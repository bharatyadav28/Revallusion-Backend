// Certificate Advertisement Routes
const express = require("express");

const {
  createCertificateAdd,
  getCertificateAdd,
  deleteCertificateAdd,
} = require("./certficateAdd.controller.js");
const { upload } = require("../../utils/s3");

const router = express.Router();

router
  .route("/")
  .post(upload.single("file"), createCertificateAdd)
  .get(getCertificateAdd)
  .put(createCertificateAdd)
  .delete(deleteCertificateAdd);

module.exports = router;
