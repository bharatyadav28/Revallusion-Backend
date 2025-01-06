// Query Routes (contact us)
const express = require("express");

const {
  createQuery,
  getQueries,
  getQuery,
  deleteQuery,
} = require("./query.controller");
const { upload } = require("../../utils/s3");
const { auth, isAdmin } = require("../../middlewares/authentication");

const router = express.Router();

router
  .route("/")
  .post(upload.single("file"), createQuery)
  .get(auth, isAdmin, getQueries);
router
  .route("/:id")
  .get(auth, isAdmin, getQuery)
  .delete(auth, isAdmin, deleteQuery);

module.exports = router;
