const TransactionModel = require("./transaction.model");

exports.getAllTransactions = async (req, res) => {
  let { search, paymentId, from, to, currentPage } = req.query;

  const query = {};
  search = search?.trim();
  if (search) {
    const searchRegExp = new RegExp(search, "i");
    query.$or = [
      { "user.name": { $regex: searchRegExp } },
      { "user.email": { $regex: searchRegExp } },
    ];
  }

  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to);
  }

  if (paymentId) query.payment_id = paymentId;

  const page = currentPage || 1;
  const limit = 8;
  const skip = (page - 1) * limit;

  const transactionsPromise = TransactionModel.aggregate([
    {
      $lookup: {
        from: "users",
        let: {
          userId: "$user",
        },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$_id", "$$userId"] },
            },
          },
          {
            $project: {
              _id: 0,
              name: 1,
              email: 1,
            },
          },
        ],
        as: "user",
      },
    },
    {
      $set: {
        user: {
          $arrayElemAt: ["$user", 0],
        },
      },
    },
    {
      $match: query,
    },
    {
      $sort: {
        createdAt: -1,
      },
    },

    {
      $skip: skip,
    },
    {
      $limit: limit,
    },
  ]);

  const totalTransactionsPromise = TransactionModel.countDocuments(query);

  const [transactions, totalTransactions] = await Promise.all([
    transactionsPromise,
    totalTransactionsPromise,
  ]);

  const pagesCount = Math.ceil(totalTransactions / limit);

  return res.status(200).json({
    success: true,
    message: "Transactions fetched successfully",
    data: {
      transactions,
      pagesCount,
    },
  });
};
