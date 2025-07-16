const { StatusCodes } = require("http-status-codes");

const QueryModel = require("./query.model.js");
const { NotFoundError, BadRequestError } = require("../../errors/index.js");

const { appendBucketName } = require("../../utils/helperFuns.js");
const { s3Uploadv4Query } = require("../../utils/s3.js");
const sendEmail = require("../../utils/sendEmail.js");

// Create new query
exports.createQuery = async (req, res) => {
  const { name, email, mobile, profile, address, message, profession } =
    req.body;

  if (!email) {
    throw new BadRequestError("Please enter your email");
  }

  if (!mobile || !/^\d{10}$/.test(mobile)) {
    throw new BadRequestError("Please enter a valid mobile number");
  }

  let result = "";

  // Upload image or document file only
  if (req.file) {
    // Validate file size
    if (req.file.size > 10 * 1024 * 1024) {
      throw new BadRequestError("File size should be less than 10MB");
    }

    // Get file type
    result = await s3Uploadv4Query(req.file);
  }

  await QueryModel.create({
    name,
    email,
    mobile,
    profile,
    address,
    message,
    profession,
    file: result?.Key,
  });

  const html = `<div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>📩 New Query Submission</h2>
      <table cellspacing="0" cellpadding="10" border="1" style="border-collapse: collapse; width: 100%;">
        <tr>
          <th align="left">Name</th>
          <td>${name || "NA"}</td>
        </tr>
        <tr>
          <th align="left">Email</th>
          <td>${email || "NA"}</td>
        </tr>
        <tr>
          <th align="left">Mobile</th>
          <td>${mobile || "NA"}</td>
        </tr>
       
        <tr>
          <th align="left">Address</th>
          <td>${address || "NA"}</td>
        </tr>
        <tr>
          <th align="left">Profession</th>
          <td>${profession || "NA"}</td>
        </tr>
        <tr>
          <th align="left">Message</th>
          <td>${message || "NA"}</td>
        </tr>
        <tr>
          <th align="left">File</th>
          <td>
            ${
              result?.Key
                ? `<a href="${appendBucketName(
                    result?.Key
                  )}" target="_blank">View File</a>`
                : "No file uploaded"
            }
          </td>
        </tr>
      </table>
    </div>
  `;

  await sendEmail({
    to: "yadavbharat386@gmail.com",
    subject: "New Query",
    html,
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
