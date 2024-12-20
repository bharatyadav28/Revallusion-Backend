// Query Routes (contact us)
const express = require("express");

const {
  createQuery,
  getQueries,
  getQuery,
  deleteQuery,
} = require("./query.controller");
const { upload } = require("../../utils/s3");

const router = express.Router();

router.route("/").post(upload.single("file"), createQuery).get(getQueries);
router.route("/:id").get(getQuery).delete(deleteQuery);

module.exports = router;
