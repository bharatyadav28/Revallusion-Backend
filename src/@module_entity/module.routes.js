const express = require("express");

const {
  createModule,
  getModules,
  getModule,
  updateModule,
  deleteModule,
} = require("./module.controller");
const { auth, isAdmin } = require("../../middlewares/authentication");

const router = express.Router();

router.route("/").post(auth, isAdmin, createModule).get(getModules);
router
  .route("/:id")
  .get(getModule)
  .put(auth, isAdmin, updateModule)
  .delete(auth, isAdmin, deleteModule);

module.exports = router;
