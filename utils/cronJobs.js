const cron = require("node-cron");

const OrderModel = require("../src/@order_entity/order.model");

// cron.schedule("*/1 * * * *", async () => {
cron.schedule("0 0 * * *", async () => {
  try {
    const result = await OrderModel.updateMany(
      {
        expiry_date: { $lte: new Date() },
        status: "Active",
      },
      {
        $set: { status: "Expire" },
      }
    );
    console.log(`Updated ${result.modifiedCount} expired orders.`);
  } catch (error) {
    console.log(error);
  }
});
