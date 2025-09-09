const express = require("express");
const { assign } = require("nodemailer/lib/shared");
const {
  addAssignmentResources,
  getAssignmentResourcesByVideoId,
} = require("./assignment_resources.controller");

const AssignmentResourcesRouter = express.Router();

AssignmentResourcesRouter.route("/:videoId")
  .put(addAssignmentResources)
  .get(getAssignmentResourcesByVideoId);

module.exports = AssignmentResourcesRouter;
