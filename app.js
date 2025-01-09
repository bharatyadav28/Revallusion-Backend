const express = require("express");
const cors = require("cors");
const errorMiddleware = require("./middlewares/error");
const dotenv = require("dotenv");
const pageNotFound = require("./middlewares/pageNotFound");
const cookieParser = require("cookie-parser");
const path = require("path");
require("express-async-errors");

const app = express();
dotenv.config({ path: "./config/config.env" });

// Predefined middlewares
app.use(express.json());
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE", "UPDATE", "PUT", "PATCH"],
    credentials: true,
  })
);
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res, next) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

// Main apis
const heroSectionRouter = require("./src/@hero_section_entity/heroSection.index");
const mentorRouter = require("./src/@mentor_entity/mentor.index");
const carousalRouter = require("./src/@carousal_entity/carousal.index");
const faqRouter = require("./src/@faq_entity/faq.index");
const pageRouter = require("./src/@page_entity/page.index");
const planRouter = require("./src/@plan_entity/plan.index");
const certificateAddRouter = require("./src/@certificate_add_entity/certificateAdd.index");
const moduleRouter = require("./src/@module_entity/module.index");
const queryRouter = require("./src/@query_entity/query.index");
const userRouter = require("./src/@user_entity/user.index");
const adminRouter = require("./src/@admin_entity/admin.index");

// Paths
// Landing page static paths
app.use("/api/v1/content/hero-section", heroSectionRouter);
app.use("/api/v1/content/mentor", mentorRouter);
app.use("/api/v1/content/carousal", carousalRouter);
app.use("/api/v1/content/faq", faqRouter);
app.use("/api/v1/content/page", pageRouter);
app.use("/api/v1/content/plan", planRouter);
app.use("/api/v1/content/certificate", certificateAddRouter);

app.use("/api/v1/module", moduleRouter);
app.use("/api/v1/query", queryRouter);

app.use("/api/v1/user", userRouter);
app.use("/api/v1/admin", adminRouter);

// Notfound and error middlewares
app.use(pageNotFound);
app.use(errorMiddleware);

module.exports = app;
