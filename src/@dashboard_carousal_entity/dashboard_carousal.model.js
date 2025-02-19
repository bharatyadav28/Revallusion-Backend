const mongoose = require("mongoose");

const DashboardCarousalSchema = new mongoose.Schema(
  {
    image: {
      type: String,
      trim: true,
      required: [true, "Please provide image url"],
    },
    sequence: {
      type: Number,
      required: [true, "Please enter image sequence"],
    },
  },
  { timestamps: true }
);

DashboardCarousalSchema.index({ sequence: 1 });

// Get next sequence number in the list
DashboardCarousalSchema.statics.getNextSequence = async function () {
  const maxSequence = await this.findOne(
    {},
    { sequence: 1 },
    { sort: { sequence: -1 } }
  );

  return (maxSequence?.sequence || 0) + 1;
};

const DashboardCarousalModel = mongoose.model(
  "DashboardCarousal",
  DashboardCarousalSchema
);

module.exports = DashboardCarousalModel;
