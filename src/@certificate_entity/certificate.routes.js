const express = require("express");

const {
  generateMyCertificate,
  getCertificates,
  createCertfifcateTest,
  leaderBoard,
} = require("./certificate.controller");
const { auth } = require("../../middlewares/authentication");

const router = express.Router();

router.route("/").post(auth, generateMyCertificate).get(auth, getCertificates);

router.route("/leader-board").get(leaderBoard);

// Test
router.route("/create").get(createCertfifcateTest);

module.exports = router;
