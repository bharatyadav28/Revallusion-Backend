const express = require("express");

const { auth, isAdmin } = require("../../middlewares/authentication");
const {
  addSubModule,
  updateSubModule,
  deleteSubModule,
} = require("./submodule.controller");

const router = express.Router();

router.route("/").post(auth, isAdmin, addSubModule);
router
  .route("/:id")
  .put(auth, isAdmin, updateSubModule)
  .delete(auth, isAdmin, deleteSubModule);

module.exports = router;
