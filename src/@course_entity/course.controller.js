const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");

const courseModel = require("./course.model.js");
const { NotFoundError, BadRequestError } = require("../../errors/index.js");
const { StringToObjectId } = require("../../utils/helperFuns.js");
const VideoModel = require("../@video_entity/video.model.js");
const PlanModel = require("../@plan_entity/plan.model.js");
const OrderModel = require("../@order_entity/order.model.js");
const { awsUrl } = require("../../utils/helperFuns.js");

// Add a course
exports.addCourse = async (req, res) => {
  const { plan, title, modules } = req.body;

  if (!title) {
    throw new BadRequestError("Please enter course title");
  }
  const course = await courseModel.create({ plan, title, modules });

  if (!course) {
    throw new BadRequestError("Course not created");
  }

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: "Course created Successfully",
  });
};

// Get all courses
exports.getCourses = async (req, res) => {
  const courses = await courseModel.find();

  res.status(StatusCodes.OK).json({
    success: true,
    data: { courses },
  });
};

// Get courses names
exports.getCoursesNames = async (req, res) => {
  const courses = await courseModel.find().select("title isFree").sort({
    isFree: -1,
  });

  res.status(StatusCodes.OK).json({
    success: true,
    data: { courses },
  });
};

// Get a single course
exports.getCourse = async (req, res) => {
  const [course] = await courseModel.aggregate([
    {
      // Stage 1
      $match: {
        _id: StringToObjectId(req.params.id),
      },
    },
    {
      $lookup: {
        // Stage 2, fetch course modules
        from: "coursemodules",
        localField: "_id",
        foreignField: "course",
        pipeline: [
          //  Select specific modules fields
          {
            $addFields: {
              thumbnailUrl: {
                $concat: [awsUrl, "/", "$thumbnailUrl"],
              },
            },
          },
          { $project: { _id: 1, name: 1, thumbnailUrl: 1 } },

          {
            // Fetch course submodules
            $lookup: {
              from: "submodules",
              localField: "_id",
              foreignField: "module",
              pipeline: [
                // Sort submodules by sequence
                { $sort: { sequence: 1 } },
                {
                  $addFields: {
                    thumbnailUrl: {
                      $concat: [awsUrl, "/", "$thumbnailUrl"],
                    },
                  },
                },

                // Nested lookup to get videos for each submodule
                {
                  $project: {
                    _id: 1,
                    name: 1,
                    sequence: 1,
                    thumbnailUrl: 1,
                    resource: 1,
                  },
                },
                {
                  // Fetch submodule videos
                  $lookup: {
                    from: "videos",
                    localField: "_id",
                    foreignField: "submodule",
                    pipeline: [
                      // Only get active and non-deleted videos
                      {
                        $match: {
                          isDeleted: false,
                        },
                      },
                      // Sort videos by sequence
                      { $sort: { sequence: 1 } },
                    ],
                    as: "videos",
                  },
                },
              ],
              as: "submodules",
            },
          },
        ],
        as: "modules",
      },
    },
    {
      // Stage 3  Free videos for introducory course
      $lookup: {
        from: "videos",
        localField: "_id",
        foreignField: "course",
        pipeline: [
          {
            $match: {
              isDeleted: false,
              submodule: null, // Only get videos directly linked to course
            },
          },
          { $sort: { sequence: 1 } },
        ],
        as: "freeVideos",
      },
    },
    { $limit: 1 },
  ]);

  if (!course) {
    throw new NotFoundError("Course not found");
  }

  const maxLevelCourse = await courseModel
    .findOne()
    .sort({ level: -1 })
    .limit(1)
    .select("level");

  const hasSuggestionVideos =
    course.level < maxLevelCourse.level && course.level > 0;

  console.log(maxLevelCourse, course.level, hasSuggestionVideos);

  res.status(StatusCodes.OK).json({
    success: true,
    data: { course: course, hasSuggestionVideos },
  });
};

// Update a course
exports.updateCourse = async (req, res) => {
  const course = await courseModel.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!course) {
    throw new NotFoundError("Course not found");
  }
  res.status(StatusCodes.OK).json({
    success: true,
    data: { course },
  });
};

exports.updateVideoSequence = async (req, res) => {
  let { courseId, moduleId, submoduleId, sequence } = req.body;
  const videoId = req.params.id;

  let query = {
    _id: StringToObjectId(videoId),
  };
  if (courseId) query.course = StringToObjectId(courseId);
  if (moduleId) query.module = StringToObjectId(moduleId);
  if (submoduleId) query.submodule = StringToObjectId(submoduleId);

  const video = await VideoModel.findOne(query);
  if (!video) throw new NotFoundError("Requested video may not exists");

  if (video.sequence !== sequence) {
    // Validate sequence number
    if (sequence < 1) sequence = 1;

    // Sequence  number must not exceeds limit
    const newSequenceLimit = await VideoModel.getNextSequence({
      course: courseId,
      submodule: submoduleId,
    });

    if (sequence >= newSequenceLimit) sequence = newSequenceLimit - 1;

    const query = {};
    if (video.submodule) {
      query.submodule = video.submodule;
    } else if (video.course) {
      query.course = video.course;
      query.submodule = null;
    }

    // Start a session
    const session = await mongoose.startSession();

    try {
      // Perform multiple operation, one fail then roll back

      await session.withTransaction(async () => {
        const oldSequence = video.sequence;

        if (sequence > oldSequence) {
          // 2. Moving down: decrease sequence of items in between
          await VideoModel.updateMany(
            {
              ...query,
              sequence: { $gt: oldSequence, $lte: sequence },
            },
            { $inc: { sequence: -1 } },
            { session }
          );
        } else if (sequence < oldSequence) {
          //3.  Moving up: increase sequence of items in between
          const r = await VideoModel.updateMany(
            {
              ...query,
              sequence: { $gte: sequence, $lt: oldSequence },
            },
            { $inc: { sequence: 1 } },
            { session }
          );
        }

        // Update the submodule's sequence
        video.sequence = sequence;
        await video.save({ session });
      });

      await session.endSession();
    } catch (error) {
      await session.endSession();
      throw error;
    }
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Video sequence updated successfully",
  });
};

exports.getCourseTitle = async (req, res) => {
  const { id } = req.params;

  const course = await courseModel.findById(id).select("title");
  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Course name fetched successfully",
    course,
  });
};

// Fetch Subscribed course data
exports.getSubscribedPlanCourse = async (req, res) => {
  const userId = req.user._id;
  const userRole = req.user.role;
  const { planId } = req.params;

  if (userRole !== "staff") {
    // Access user plan
    const orderPromise = OrderModel.findOne({
      user: userId,
      status: "Active",
    }).populate({
      path: "plan",
      select: "_id level",
    });

    const requestedPlanPromise = PlanModel.findById(planId);

    const [order, requestedPlan] = await Promise.all([
      orderPromise,
      requestedPlanPromise,
    ]);

    if (!order) {
      throw new NotFoundError("Please subscribe to a plan");
    }
    if (!requestedPlan) {
      throw new NotFoundError("Requested plan may not exists");
    }

    // const currentPlanLevel = order.plan.level;

    // Check if user has access to this course
    // if (
    //   currentPlanLevel === Number(process.env.BEGINNER_PLAN) &&
    //   requestedPlan.level === Number(process.env.ADVANCE_PLAN)
    // ) {
    //   throw new BadRequestError(
    //     "Please upgrade your plan to access this course"
    //   );
    // }
  }

  const [courseData] = await courseModel.aggregate([
    {
      // Stage 1
      $match: {
        plan: new mongoose.Types.ObjectId(planId),
      },
    },
    {
      // Stage 2: fetch modules of a couse
      $lookup: {
        from: "coursemodules",
        localField: "_id",
        foreignField: "course",
        pipeline: [
          // Select specific module fields

          {
            // Fetch submodules of a module
            $lookup: {
              from: "submodules",
              localField: "_id",
              foreignField: "module",

              pipeline: [
                // Sort modules by sequence
                { $sort: { sequence: 1 } },

                {
                  // Fetch videos of a submodule
                  $lookup: {
                    from: "videos",
                    localField: "_id",
                    foreignField: "submodule",
                    pipeline: [
                      {
                        $match: {
                          isDeleted: false,
                          isActive: true,
                        },
                      },
                      {
                        // Append aws url to thumbnail path
                        $addFields: {
                          thumbnailUrl: {
                            $concat: [awsUrl, "/", "$thumbnailUrl"],
                          },
                        },
                      },
                      { $sort: { sequence: 1 } },
                      {
                        $project: {
                          _id: 1,
                          title: 1,
                          thumbnailUrl: 1,
                          duration: 1,
                          sequence: 1,
                          lock: 1,
                        },
                      },
                    ],
                    as: "videos",
                  },
                },

                {
                  $addFields: {
                    thumbnailUrl: {
                      $concat: [awsUrl, "/", "$thumbnailUrl"],
                    },
                    videoCount: { $size: { $ifNull: ["$videos", []] } },
                  },
                },

                // Select specific submodule fields
                {
                  $project: {
                    _id: 1,
                    name: 1,
                    thumbnailUrl: 1,
                    sequence: 1,
                    videoCount: 1,
                    videos: 1,
                  },
                },
              ],
              as: "submodules",
            },
          },

          {
            // Append aws url to thumbnail path
            $addFields: {
              thumbnailUrl: {
                $concat: [awsUrl, "/", "$thumbnailUrl"],
              },
            },
          },

          {
            $project: {
              _id: 1,
              name: 1,
              videoCount: { $sum: "$submodules.videoCount" },
              submodules: 1,
              thumbnailUrl: 1,
            },
          },
        ],
        as: "modules",
      },
    },

    {
      // Stage 3: Select specific course fields
      $project: {
        _id: 1,
        title: 1,
        modules: 1,
        totalVideos: { $sum: "$modules.videoCount" },
      },
    },
  ]);

  res.status(StatusCodes.OK).json({
    success: true,
    data: { course: courseData },
    message: "Course fetch successfully",
  });
};
