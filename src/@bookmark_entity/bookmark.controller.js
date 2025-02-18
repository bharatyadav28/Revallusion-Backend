const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");

const VideoModel = require("../@video_entity/video.model");
const BookmarkModel = require("../@bookmark_entity/bookmark.model");
const { BadRequestError, NotFoundError } = require("../../errors/index.js");
const { awsUrl } = require("../../utils/helperFuns");

// Fetch all bookmarks of a user
exports.getAllBookMarks = async (req, res) => {
  const bookmarks = await BookmarkModel.aggregate([
    {
      // Stage 1
      $match: {
        user: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      // Stage 2: fetch bookmark video (array)
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "video",
        pipeline: [
          {
            $match: {
              isDeleted: false,
            },
          },
          {
            $addFields: {
              thumbnailUrl: {
                $concat: [awsUrl, "/", "$thumbnailUrl"],
              },
            },
          },
          {
            $project: {
              _id: 1,
              title: 1,
              description: 1,
              thumbnailUrl: 1,
              duration: 1,
            },
          },
        ],
      },
    },
    {
      // Stage 3: Filter out documents where video array is empty
      $match: {
        video: { $ne: [] },
      },
    },

    {
      // Stage 3: convert video array to obj (Only one video present in array)
      $unwind: {
        path: "$video",
        preserveNullAndEmptyArrays: true, // Keep documents even if no matching video is found
      },
    },
  ]);

  res.status(StatusCodes.OK).json({
    success: true,
    bookmarks,
  });
};

// Add bookmark
exports.addBookMark = async (req, res) => {
  const { videoId } = req.body;

  if (!videoId) {
    throw new BadRequestError("Please enter video id");
  }

  const videoPromise = VideoModel.findOne({ _id: videoId, isDeleted: false });

  const bookmarkPromise = BookmarkModel.findOne({
    user: req.user._id,
    video: videoId,
  });

  const [video, bookmark] = await Promise.all([videoPromise, bookmarkPromise]);

  if (!video) {
    throw new NotFoundError("Targeted video may not be available");
  }
  if (bookmark) {
    throw new BadRequestError("Video already bookmarked");
  }

  const newBookmark = await BookmarkModel.create({
    user: req.user._id,
    video: videoId,
  });

  if (!newBookmark) {
    throw new BadRequestError("Bookmark not created");
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Video bookmarked successfully",
  });
};

// Delete a bookmark
exports.deleteBookMark = async (req, res) => {
  const { id } = req.params;

  const bookmarkPromise = BookmarkModel.findByIdAndDelete(id);

  const [bookmark] = await Promise.all([bookmarkPromise]);

  if (!bookmark) {
    throw new NotFoundError("Bookmark not found");
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Bookmark deleted successfully",
  });
};
