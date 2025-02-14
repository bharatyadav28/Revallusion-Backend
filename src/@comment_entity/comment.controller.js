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
  const comments = await CommentModel.find().populate([
    {
      path: "user",
      select: "name email ",
    },
    {
      path: "video",
      select: "title description thumbnailUrl videoUrl",
    },
  ]);

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Comments fetched successfully",
    data: {
      comments,
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
