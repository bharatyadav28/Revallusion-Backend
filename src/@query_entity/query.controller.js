const { StatusCodes } = require("http-status-codes");

const QueryModel = require("./query.model.js");
const { NotFoundError, BadRequestError } = require("../../errors/index.js");
const { uploadImageToS3, uploadDocumentToS3 } = require("../../utils/s3");
const { appendBucketName } = require("../../utils/helperFuns.js");

// Create new query
exports.createQuery = async (req, res) => {
  const { name, email, mobile, profile, address, message, profession } =
    req.body;
  let result = "";

  if (!email) {
    throw new BadRequestError("Please enter your email");
  }

  if (!mobile || !/^\d{10}$/.test(mobile)) {
    throw new BadRequestError("Please enter a valid mobile number");
  }

  // Upload image or document file only
  if (req.file) {
    // Get file type
    const fileType = req.file.mimetype.split("/")[0];

    const userString = `query/${email}`;
    let uploadResult;
    if (fileType === "image") {
      uploadResult = await uploadImageToS3(req.file, userString);
    } else if (fileType === "application") {
      uploadResult = await uploadDocumentToS3(req.file, userString);
    } else {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ error: "Unsupported file type" });
    }

    // Generate image URL
    // result = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_BUCKET_REGION}.amazonaws.com/${uploadResult.Key}`;
    result = uploadResult.Key;
  }

  await QueryModel.create({
    name,
    email,
    mobile,
    profile,
    address,
    message,
    profession,
    file: result,
  });

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: "Query submitted successfully",
  });
};

// Fetch all queries
exports.getQueries = async (req, res, next) => {
  const { keyword, resultPerPage, currentPage } = req.query;
  const query = {};
  if (keyword) {
    const keywordRegExp = new RegExp(keyword, "i");
    query.$or = [
      { name: { $regex: keywordRegExp } },
      { email: { $regex: keywordRegExp } },
    ];
  }
  const totalQueryCount = await QueryModel.countDocuments(query);

  const limit = Number(resultPerPage);
  const page = Number(currentPage);
  const skip = (page - 1) * limit;

  let queries = await QueryModel.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  queries = queries.map((query) => {
    return { ...query, file: appendBucketName(query.file) };
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Queries fetched successfully",
    data: {
      queries,
      totalQueryCount,
    },
  });
};

// Fetch a single query
exports.getQuery = async (req, res, next) => {
  const query = await QueryModel.findById(req.params.id).lean();
  if (!query) throw new NotFoundError("Query not found");

  query.file = appendBucketName(query.file);

  res.status(StatusCodes.OK).json({
    success: true,
    data: { query },
    message: "Query fetched successfully",
  });
};

// Delete query
exports.deleteQuery = async (req, res, next) => {
  const query = await QueryModel.findById(req.params.id);
  if (!query) throw new NotFoundError("Query not found");
  await query.deleteOne();

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Query Deleted successfully",
  });
};
