const express = require("express");

const {
  createCertificate,
  getCertificates,
} = require("./certificate.controller");
const { auth } = require("../../middlewares/authentication");

const router = express.Router();

router.route("/").post(auth, createCertificate).get(auth, getCertificates);

module.exports = router;
