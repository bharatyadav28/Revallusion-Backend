const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");

const TransactionModel = require("./transaction.model");
const {
  isoToReadable,
  numberToWords,
  formatDateTime,
} = require("../../utils/helperFuns");
const sendEmail = require("../../utils/sendEmail");

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
    if (to) {
      const endOfDay = new Date(to);
      // Includes whole day
      endOfDay.setHours(23, 59, 59, 999);
      query.createdAt.$lte = endOfDay;
    }
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
    const logoPath = path.join(__dirname, "../../public", "/logo.png");
    const tempFilePath = path.join("/tmp", `${user._id}.pdf`);
    const doc = new PDFDocument();
    const writeStream = fs.createWriteStream(tempFilePath);

    doc.font("Helvetica");

    doc.rect(50, 50, 500, 650).stroke();

    // doc.image(logoPath, 330, 70, { width: 200, height: 60 });

    doc.fontSize(12).text("RAVALLUSION TRAINING ACADEMY LLP", 70, 150);
    doc.text("GSTIN - 37ABICS6540H1Z2", 70, 170);
    doc.text("Mobile - 9008642633", 70, 190);
    doc.text("Email - ravallusionacademy@gmail.com", 70, 210);
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
      .text("Billing To: " + (user?.name || "NA"), xColumn1, yColumn1, {
        lineGap: 5,
      })
      .text("Contact No: " + (user?.mobile || "NA"), xColumn1, doc.y, {
        lineGap: 5,
      })
      .text("Email Id: " + user.email?.slice(0, 30), xColumn1, doc.y, {
        lineGap: 1,
      })
      .text(user.email?.slice(30), xColumn1, doc.y, {
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
      ["Description", "SAC Code", `Amount =(Rs.)`],
      [
        `${plan_type}`,
        "998433",
        parseFloat(0.82 * transaction.amount).toFixed(2),
      ],
      ["IGST @ 18%", "", parseFloat(0.18 * transaction.amount).toFixed(2)],
      ["Invoice Total", "", transaction.amount],
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
      .text(
        "Note: The subscription amount is inclusive Goods and Service tax (GST) at rate of 18%.",

        70
      )
      .text("Reverse Charge Applicability: No", 70)
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
                filename: `${user?.name || "user"}.pdf`,
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
            res.status(400).send({ message: "something went wrong" });
            // reject({error:"Something went wrong"});
          }
        }
      });
    });
  });
};
