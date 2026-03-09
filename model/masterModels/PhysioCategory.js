const mongoose = require("mongoose");

// define Physio Category Schema

const PhysioCategorySchema = new mongoose.Schema(
  {
    physioCateCode: {
      type: String,
      trim: true,
      unique: true,
      // required:true
    },
    physioCateName: {
      type: String,
      trim: true,
      unique: true,
      // required:true
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);
const PhysioCategory = mongoose.model("PhysioCategory", PhysioCategorySchema);
module.exports = PhysioCategory;
