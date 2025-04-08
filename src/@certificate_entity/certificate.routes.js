const express = require("express");

const {
  generateMyCertificate,
  getCertificates,
  createCertfifcate,
} = require("./certificate.controller");
const { auth } = require("../../middlewares/authentication");

const router = express.Router();

router.route("/").post(auth, generateMyCertificate).get(auth, getCertificates);

// Test
// router.route("/create").get(createCertfifcate);

module.exports = router;
