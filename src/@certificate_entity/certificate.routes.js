const express = require("express");

const {
  generateMyCertificate,
  getCertificates,
} = require("./certificate.controller");
const { auth } = require("../../middlewares/authentication");

const router = express.Router();

router.route("/").post(auth, generateMyCertificate).get(auth, getCertificates);

module.exports = router;
