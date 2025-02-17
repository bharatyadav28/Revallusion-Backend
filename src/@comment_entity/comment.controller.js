const { StatusCodes } = require("http-status-codes");

const CommentModel = require("./comment.model");
const VideoModel = require("../@video_entity/video.model");
const { BadRequestError } = require("../../errors");

// Get Video comment
exports.getVideoComments = async (req, res) => {
  const { videoId } = req.params;

  const comments = await CommentModel.find({ video: videoId }).populate({
    path: "user",
    select: "name avatar ",
  });
  return res.status(StatusCodes.OK).json({
    success: true,
    data: { comments },
  });
};

// Create comment by user
exports.createComment = async (req, res) => {
  const { videoId } = req.params;

  const existingVideo = await VideoModel.findById(videoId);
  if (!existingVideo) {
    throw new BadRequestError("Targeted video may not exists");
  }

  await CommentModel.create({
    user: req.user._id,
    video: videoId,
    comment: req.body.comment,
  });

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: "Comment added successfully",
  });
};

// Delete comment
exports.deleteComment = async (req, res) => {
  const { id } = req.params;
  console.log("id", id);

  const deletedComment = await CommentModel.findByIdAndDelete(id);
  if (!deletedComment) {
    throw new BadRequestError("Targeted comment may not exists");
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Comment deleted successfully",
  });
};

// Get all comments
exports.getAllComments = async (req, res) => {
  const { resultPerPage, currentPage, replied, filterByDate } = req.query;

  const limit = Number(resultPerPage) || 8;
  const page = Number(currentPage) || 1;
  const skip = (page - 1) * limit;

  let query = {};

  if (typeof replied === "string") {
    const lowerReplied = replied.toLowerCase(); // Normalize input for comparison

    if (lowerReplied === "yes") {
      query.reply = { $exists: true, $ne: null };
    } else if (lowerReplied === "no") {
      query.$or = [
        { reply: "" },
        { reply: null },
        { reply: { $exists: false } },
      ];
    }
  }
  if (filterByDate) {
    const filterdDate = new Date(filterByDate); // Convert to Date object
    const nextDay = new Date(filterdDate);
    nextDay.setDate(nextDay.getDate() + 1); // Move to next day at 00:00:00

    query.createdAt = {
      $gte: filterdDate, // Start of the selected day
      $lt: nextDay, // Before the next day's start
    };
  }

  const commentsPromise = CommentModel.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate([
      {
        path: "user",
        select: "name email ",
      },
      {
        path: "video",
        select: "title description ",
      },
    ]);

  const CommentsCountPromise = CommentModel.countDocuments(query);
  const [comments, CommentsCount] = await Promise.all([
    commentsPromise,
    CommentsCountPromise,
  ]);

  const pagesCount = Math.ceil(CommentsCount / limit) || 1;

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Comments fetched successfully",
    data: {
      comments,
      pagesCount,
    },
  });
};

// Reply to comment
exports.replyComment = async (req, res) => {
  const { id } = req.params;
  const { reply } = req.body;

  if (!reply) throw new BadRequestError("Please provide reply");

  const result = await CommentModel.updateOne(
    {
      _id: id,
    },
    {
      reply,
      repliedAt: Date.now(),
    },
    {
      runValidators: true,
    }
  );

  if (result.matchedCount === 0) {
    throw new NotFoundError("Comment may not exists");
  }

  // Handle case when update did not modify any document
  if (result.modifiedCount === 0) {
    throw new BadRequestError("Comment reply failed");
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Comment replied successfully",
  });
};
