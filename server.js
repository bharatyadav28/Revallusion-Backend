const app = require("./app");
const connectDatabase = require("./config/database");

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION 💥 Shutting down...");
  console.error(err);
  process.exit(1); // 1 = error exit
});

const startServer = async () => {
  try {
    await connectDatabase(process.env.MONGO_URL);
    console.log("Connected to database successfully.");

    const PORT = process.env.PORT || 4000;
    server = app.listen(PORT, () => {
      console.log(`Server started at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Database connectivity error:", error);
    process.exit(1); // exit on failure to start server
  }
};

startServer();

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION 💥 Shutting down...");
  console.error(err);

  if (server) {
    server.close(() => {
      process.exit(1); // exit after closing server
    });
  } else {
    process.exit(1);
  }
});
