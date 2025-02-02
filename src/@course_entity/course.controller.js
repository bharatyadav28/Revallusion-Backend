const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");

const courseModel = require("./course.model.js");
const { NotFoundError, BadRequestError } = require("../../errors/index.js");
const {
  StringToObjectId,
  updateSequence,
} = require("../../utils/helperFuns.js");
const VideoModel = require("../@video_entity/video.model.js");

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
  const courses = await courseModel.find().select("title isFree");

  res.status(StatusCodes.OK).json({
    success: true,
    data: { courses },
  });
};

// Get a single course
exports.getCourse = async (req, res) => {
  const [course] = await courseModel.aggregate([
    {
      $match: {
        _id: StringToObjectId(req.params.id),
      },
    },
    {
      $lookup: {
        from: "coursemodules",
        localField: "_id",
        foreignField: "course",
        pipeline: [
          // Nested lookup to get submodules for each module
          { $project: { _id: 1, name: 1 } },
          {
            $lookup: {
              from: "submodules",
              localField: "_id",
              foreignField: "module",
              pipeline: [
                // Sort submodules by sequence
                { $sort: { sequence: 1 } },
                // Nested lookup to get videos for each submodule
                { $project: { _id: 1, name: 1, sequence: 1, thumbnailUrl: 1 } },
                {
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
    // Optional: Lookup for free videos directly associated with course
    {
      $lookup: {
        from: "videos",
        localField: "_id",
        foreignField: "course",
        pipeline: [
          {
            $match: {
              isActive: true,
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

  res.status(StatusCodes.OK).json({
    success: true,
    data: { course: course },
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
