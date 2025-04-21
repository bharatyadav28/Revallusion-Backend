const express = require("express");
const {
  getActiveGateways,
  updateActiveGateway,
} = require("./app_config.controller");

const router = express.Router();

router
  .route("/active-gateways")
  .get(getActiveGateways)
  .put(updateActiveGateway);

module.exports = router;
