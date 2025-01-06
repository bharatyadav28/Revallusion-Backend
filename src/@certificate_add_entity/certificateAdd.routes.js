// Certificate Advertisement Routes
const express = require("express");

const {
  createCertificateAdd,
  getCertificateAdd,
  deleteCertificateAdd,
} = require("./certficateAdd.controller.js");
const { upload } = require("../../utils/s3");
const { auth, isAdmin } = require("../../middlewares/authentication");

const router = express.Router();

router
  .route("/")
  .post(auth, isAdmin, upload.single("file"), createCertificateAdd)
  .get(getCertificateAdd)
  .put(auth, isAdmin, createCertificateAdd)
  .delete(auth, isAdmin, deleteCertificateAdd);

module.exports = router;
