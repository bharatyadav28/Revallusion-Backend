const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const JSZip = require("jszip");
const XLSX = require("xlsx");

const TransactionModel = require("./transaction.model");
const {
  isoToReadable,
  numberToWords,
  formatDateTime,
  awsUrl,
} = require("../../utils/helperFuns");
const sendEmail = require("../../utils/sendEmail");
const { default: mongoose } = require("mongoose");
const { StatusCodes } = require("http-status-codes");
const { BadRequestError } = require("../../errors");

exports.getAllTransactions = async (req, res) => {
  let { search, from, to, currentPage, sortByAmount, sortByDate, status } =
    req.query;

  if (from && to) {
    if (new Date(from) > new Date(to)) {
      throw new BadRequestError(`"To" date should be greater than "from" date`);
    }
  }

  // const query = { status: "Completed" };
  const query = {};
  if (status === "Completed" || status === "Failed") {
    query.status = status;
  }

  search = search?.trim();
  if (search) {
    const searchRegExp = new RegExp(search, "i");
    query.$or = [
      { "user.name": { $regex: searchRegExp } },
      { "user.email": { $regex: searchRegExp } },
      { payment_id: { $regex: searchRegExp } },
    ];
  }

  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) {
      const endOfDay = new Date(to);
      // Includes whole day
      endOfDay.setHours(23, 59, 59, 999);
      query.createdAt.$lte = endOfDay;
    }
  }

  let sort = {
    createdAt: -1,
  };
  if (sortByAmount) {
    sort = { amount: sortByAmount === "asc" ? 1 : -1, ...sort };
  }
  if (sortByDate) {
    sort = { ...sort, createdAt: sortByDate === "asc" ? 1 : -1 };
  }

  // if (paymentId) query.payment_id = paymentId;

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
      $lookup: {
        from: "orders",
        let: {
          orderId: "$order",
        },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$_id", "$$orderId"] },
            },
          },
          {
            $project: {
              _id: 0,
              plan: 1,
            },
          },
        ],
        as: "order",
      },
    },

    {
      $set: {
        plan: { $arrayElemAt: ["$order.plan", 0] },
      },
    },
    {
      $match: query,
    },
    {
      $sort: sort,
    },

    {
      $skip: skip,
    },
    {
      $limit: limit,
    },
    {
      $set: {
        invoice_url: { $concat: [awsUrl, "/", "$invoice_url"] },
      },
    },
    {
      $project: {
        order: 0,
        updatedAt: 0,
        __v: 0,
      },
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

exports.sendInvoice = async ({ user, transaction, invoice_no, plan_type }) => {
  return new Promise((resolve, reject) => {
    const logoPath = path.join(__dirname, "../../public", "/favicon.png");
    const tempFilePath = path.join("/tmp", `Ravallusion.pdf`);
    const doc = new PDFDocument();
    const writeStream = fs.createWriteStream(tempFilePath);

    doc.font("Helvetica");

    doc.rect(50, 50, 500, 650).stroke();

    doc.image(logoPath, 430, 70, { width: 100, height: 100 });

    doc.fontSize(12).text("RAVALLUSION TRAINING ACADEMY LLP", 70, 190);
    // doc.text("GSTIN - 37ABICS6540H1Z2", 70, 170);
    doc.text("Mobile - 9008642633", 70, 210);
    doc.text("Email - ravallusionacademy@gmail.com", 70, 230);
    doc.moveDown(2);
    doc.font("Helvetica-Bold").fontSize(24).text("Tax Invoice", {
      align: "center",
    });

    let xColumn1 = 70;
    let yColumn1 = doc.y + 10;

    let xColumn2 = 300;
    let yColumn2 = doc.y + 10;

    doc.moveDown(4);

    doc
      .font("Helvetica")
      .fontSize(12)
      .text(
        "Billing To: " + (user?.name || user?._id || "NA"),
        xColumn1,
        yColumn1,
        {
          lineGap: 5,
        }
      )
      .text("Contact No: " + (user?.mobile || "NA"), xColumn1, doc.y, {
        lineGap: 5,
      })
      .text("Email Id: " + user.email, xColumn1, doc.y, {
        lineGap: 5,
      })

      .text("State: " + user?.state || "NA", xColumn1, doc.y, {
        lineGap: 10,
      });

    doc
      .text(
        "Transaction Date: " + formatDateTime(transaction.createdAt),
        xColumn2,
        yColumn2,
        {
          align: "right",
          lineGap: 5,
        }
      )
      .text("Transaction Id: " + transaction.payment_id, xColumn2, doc.y, {
        align: "right",
        lineGap: 5,
      })
      .text(
        "Transaction No: R-" +
          formatDateTime(transaction.createdAt, true)?.replaceAll(" ", "") +
          "-" +
          +invoice_no,
        xColumn2,
        doc.y,
        {
          align: "right",
          lineGap: 10,
        }
      );

    const tableMarginTop = 52;
    const borderWidth = 1;
    const cellPadding = 8;

    const tableData = [
      ["Description", `Amount =(Rs.)`],
      [`${plan_type}`, transaction.amount],
    ];

    let tableTop = doc.y + tableMarginTop;
    doc.lineWidth(borderWidth);

    for (let i = 0; i < tableData.length; i++) {
      let rowTop = tableTop + i * (borderWidth * 2 + cellPadding * 2);
      for (let j = 0; j < tableData[i].length; j++) {
        let cellLeft = 70 + j * 150;
        let cellWidth = 150;
        let cellHeight = borderWidth * 2 + cellPadding * 2;
        doc.rect(cellLeft, rowTop, cellWidth, cellHeight).stroke();
        doc.text(
          tableData[i][j],
          cellLeft + cellPadding,
          rowTop + borderWidth + 3.5
        );
      }
    }

    doc.moveDown(2);
    doc
      .fontSize(10)
      .text(`Amount in words (INR): ` + numberToWords(transaction.amount), 70)
      // .text(
      //   "Note: The subscription amount is inclusive Goods and Service tax (GST) at rate of 18%.",

      //   70
      // )
      // .text("Reverse Charge Applicability: No", 70)
      .text("See Terms and Conditions on the www.ravallusion.com website", 70);

    doc.moveDown(4);

    doc
      .fontSize(12)
      .text("This is System generated invoice", { align: "center" })
      .moveDown(0.4)
      .text("RAVALLUSION TRAINING ACADEMY LLP", {
        align: "center",
        bold: true,
        marginBottom: 10,
      })
      .moveDown(0.4)
      .text("D NO 85-40-4/4, F S-1, SRI SARASWATHI NIVAS APPT,", {
        align: "center",
        marginBottom: 10,
      })
      .moveDown(0.4)
      .text("RAJAHMUNDRY, East Godavari,", {
        align: "center",
        marginBottom: 10,
      })
      .moveDown(0.4)
      .text("Andhra Pradesh, India, 533101", {
        align: "center",
        marginBottom: 10,
      });

    doc.end();
    doc.pipe(writeStream);

    writeStream.on("finish", () => {
      fs.readFile(tempFilePath, async (err, data) => {
        if (err) {
          console.log("Error", data, err);
        } else {
          const html = `<div style="font-family: 'Arial', sans-serif; text-align: center; background-color: #f4f4f4; margin: 0; padding: 15px 0;">
            <div style="max-width: 600px; margin: 30px auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); text-align: center;">
              <h1 style="color: #333333; font-size: 24px; margin: 20px 0;">Hey ${
                user.name || "user"
              }! Your Payment of ₹ ${
            transaction.amount
          } has been done successfully</h1>
              <p style="color: #666666; font-size: 16px; margin: 10px 0;">You have now access to our paid content.</p> 
              <p style="color: #666666; font-size: 14px; margin: 10px 0;">
                If you did not request this mail, please ignore this email.
              </p>
            </div>
            <div style="color: #888888; margin-top: 20px;">
              <p style="margin: 0;">Regards, <span style="color: #caa257;">Team Ravallusion</span></p>
            </div>
          </div>
`;

          try {
            const attachments = [
              {
                filename: `${"Ravallusion"}.pdf`,
                path: tempFilePath,
                content: data.toString("base64"),
                encoding: "base64",
              },
            ];

            await sendEmail({
              to: user.email,
              subject: "Invoice",
              html,
              attachments,
            });
            // console.log(data);
            fs.unlink(tempFilePath, (err) => {});
            resolve(data);
          } catch (error) {
            console.log(error);
            // res.status(400).send({ message: "something went wrong" });
            reject({ error: "Something went wrong" });
          }
        }
      });
    });
  });
};

exports.getFilteredTransactions = async (req, res, next) => {
  const { from, to } = req.query;
  const query = { status: "Completed" };

  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) {
      const endOfDay = new Date(to);
      // Includes whole day
      endOfDay.setHours(23, 59, 59, 999);
      query.createdAt.$lte = endOfDay;
    }
  }

  const transactions = await TransactionModel.aggregate([
    {
      $match: query,
    },
    {
      $set: {
        invoice_url: { $concat: [awsUrl, "/", "$invoice_url"] },
      },
    },
    {
      $project: {
        invoice_url: 1,
        payment_id: 1,
      },
    },
  ]);

  res.status(200).json({
    success: true,
    message: "Transactions fetched successfully",
    data: { transactions },
  });
};

exports.getUserTransactions = async (req, res) => {
  const userId = req.params.id;
  const { currentPage } = req.query;

  const page = currentPage || 1;
  const limit = 4;
  const skip = (page - 1) * limit;

  const transactionsPromise = TransactionModel.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
      },
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
    {
      $lookup: {
        from: "orders",
        let: {
          orderId: "$order",
        },

        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$_id", "$$orderId"],
              },
            },
          },

          {
            $project: {
              _id: 0,
              plan: 1,
            },
          },
        ],
        as: "order",
      },
    },
    {
      $set: {
        plan: {
          $arrayElemAt: ["$order.plan", 0],
        },

        invoice_url: { $concat: [awsUrl, "/", "$invoice_url"] },
      },
    },
    {
      $project: {
        payment_id: 1,
        gateway: 1,
        amount: 1,
        status: 1,
        invoice_url: 1,
        plan: 1,
        createdAt: 1,
      },
    },
  ]);

  const totalUserTransactionsPromise = TransactionModel.countDocuments({
    user: userId,
  });

  const [transactions, totalUserTransactions] = await Promise.all([
    transactionsPromise,
    totalUserTransactionsPromise,
  ]);
  const pagesCount = Math.ceil(totalUserTransactions / limit);

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "User transactions fetched successfully",
    data: {
      transactions,
      pagesCount,
    },
  });
};

exports.downloadAsCsv = async (req, res, next) => {
  const { from, to } = req.query;
  const query = { status: "Completed" };

  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) {
      const endOfDay = new Date(to);
      // Includes whole day
      endOfDay.setHours(23, 59, 59, 999);
      query.createdAt.$lte = endOfDay;
    }
  }

  const data = await TransactionModel.aggregate([
    {
      $match: query,
    },
    {
      $lookup: {
        from: "users",
        let: {
          userId: "$user",
        },
        pipeline: [
          {
            $match: { $expr: { $eq: ["$_id", "$$userId"] } },
          },
          {
            $project: {
              name: 1,
              email: 1,
              _id: 1,
            },
          },
        ],
        as: "user",
      },
    },
    {
      $unwind: "$user",
    },
    {
      $lookup: {
        from: "orders",
        let: {
          orderId: "$order",
        },
        pipeline: [
          {
            $match: { $expr: { $eq: ["$_id", "$$orderId"] } },
          },
          {
            $lookup: {
              from: "plans",
              let: { planId: "$plan" },
              pipeline: [
                {
                  $match: { $expr: { $eq: ["$_id", "$$planId"] } },
                },
                {
                  $project: {
                    plan_type: 1,
                  },
                },
              ],
              as: "plan",
            },
          },
          {
            $unwind: "$plan",
          },
          {
            $project: {
              plan: 1,
            },
          },

          {
            $project: {
              plan: 1,
            },
          },
        ],
        as: "order",
      },
    },
    {
      $unwind: "$order",
    },
    {
      $set: {
        date: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$createdAt",
            timezone: "Asia/Kolkata", // optional: adjust based on your timezone
          },
        },
      },
    },

    {
      $project: {
        name: "$user.name",
        email: "$user.email",
        plan: "$order.plan.plan_type",
        amount: 1,
        gateway: 1,
        payment_id: 1,
        date: 1,
        _id: 0,
      },
    },
  ]);

  // return res.status(200).json({ data });

  // Convert data to worksheet
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Create workbook and add the worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  // Write the workbook to a buffer
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  // Set response headers
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", "attachment; filename=users.xlsx");

  // Send the buffer as the response
  // console.log(buffer)

  res.status(200).send(buffer);
};
