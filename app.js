const express = require("express");
const cors = require("cors");
const errorMiddleware = require("./middlewares/error");
const dotenv = require("dotenv");
const pageNotFound = require("./middlewares/pageNotFound");
const cookieParser = require("cookie-parser");
const path = require("path");
const Razorpay = require("razorpay");
require("express-async-errors");

const app = express();
dotenv.config({ path: "./config/config.env" });

// Razorpay API
exports.instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Predefined middlewares
app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://revallusion-admin.vercel.app",
      "https://ravallusion-repo-mine.vercel.app",
      "https://www.ravallusion.com",
      "https://ravallusion.com",
    ],
    methods: ["GET", "POST", "DELETE", "UPDATE", "PUT", "PATCH"],
    credentials: true,
  })
);
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res, next) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

// Main apis
const heroSectionRouter = require("./src/@hero_section_entity/heroSection.index");
const mentorRouter = require("./src/@mentor_entity/mentor.index");
const carousalRouter = require("./src/@carousal_entity/carousal.index");
const latestTutorialsRouter = require("./src/@latest_tutorials_entity/latest_tutorials.index");
const faqRouter = require("./src/@faq_entity/faq.index");
const pageRouter = require("./src/@page_entity/page.index");
const planRouter = require("./src/@plan_entity/plan.index");
const certificateAddRouter = require("./src/@certificate_add_entity/certificateAdd.index");

const moduleRouter = require("./src/@module_entity/module.index");
const queryRouter = require("./src/@query_entity/query.index");
const userRouter = require("./src/@user_entity/user.index");
const adminRouter = require("./src/@admin_entity/admin.index");
const videoRouter = require("./src/@video_entity/video.index");
const courseRouter = require("./src/@course_entity/course.index");
const courseModuleRouter = require("./src/@course_module_entity/course_module.index");
const submoduleRouter = require("./src/@submodule_entity/submodule.index");
const orderRouter = require("./src/@order_entity/order.index");
const assignmentRouter = require("./src/@assignment_entity/assignment.index");
const SubmittedAssignmentRouter = require("./src/@submitted_assignment_entity/submitted_assignment.index");
const BookmarkRouter = require("./src/@bookmark_entity/bookmark.index");
const CommentRouter = require("./src/@comment_entity/comment.index");

// Paths
// Landing page static paths
app.use("/api/v1/content/hero-section", heroSectionRouter);
app.use("/api/v1/content/mentor", mentorRouter);
app.use("/api/v1/content/carousal", carousalRouter);
app.use("/api/v1/content/latest-tutorials", latestTutorialsRouter);
app.use("/api/v1/content/faq", faqRouter);
app.use("/api/v1/content/page", pageRouter);
app.use("/api/v1/content/plan", planRouter);
app.use("/api/v1/content/certificate", certificateAddRouter);

app.use("/api/v1/module", moduleRouter);
app.use("/api/v1/query", queryRouter);

app.use("/api/v1/user", userRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/video", videoRouter);
app.use("/api/v1/course/module", courseModuleRouter);
app.use("/api/v1/course/submodule", submoduleRouter);
app.use("/api/v1/course", courseRouter);

app.use("/api/v1/order", orderRouter);
app.use("/api/v1/assignment", assignmentRouter);
app.use("/api/v1/submitted-assignment", SubmittedAssignmentRouter);
app.use("/api/v1/bookmark", BookmarkRouter);
app.use("/api/v1/comment", CommentRouter);

// Notfound and error middlewares
app.use(pageNotFound);
app.use(errorMiddleware);

module.exports = app;
