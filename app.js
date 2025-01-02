const express = require("express");
const cors = require("cors");
const errorMiddleware = require("./middlewares/error");
const dotenv = require("dotenv");
const pageNotFound = require("./middlewares/pageNotFound");
const cookieParser = require("cookie-parser");
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

app.get("/", (req, res, next) => res.json({ anc: "abc" }));

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

const {
  getHomeContent,
  uploadImage,
} = require("./src/@user_entity/user.controller");
const { upload } = require("./utils/s3");
const { auth } = require("./middlewares/authentication");

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

app.get("/api/v1/home", getHomeContent);
app.post("/api/v1/upload-image", upload.single("file"), uploadImage);

// Notfound and error middlewares
app.use(pageNotFound);
app.use(errorMiddleware);

module.exports = app;
