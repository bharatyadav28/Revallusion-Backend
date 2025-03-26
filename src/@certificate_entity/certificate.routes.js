const express = require("express");

const { createCertificate } = require("./certificate.controller");
const { auth } = require("../../middlewares/authentication");

const router = express.Router();

router.route("/").post(auth, createCertificate);

module.exports = router;
