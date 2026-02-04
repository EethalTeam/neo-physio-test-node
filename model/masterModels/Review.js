const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
    },
    physioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Physio",
    },
    reviewDate: {
      type: Date,
    },
    Satisfaction: {
      type: Number,
      min: 0,
      max: 100,
    },
    reviewTime: {
      type: String,
    },
    reviewStatusId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReviewStatus",
    },
    reviewTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReviewType",
      // required: true,
    },
    redFlags: [
      {
        redFlagId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "RedFlag",
        },
      },
    ],
    feedback: {
      type: String,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
    },
  },
  { timestamps: true },
);
const ReviewModel = mongoose.model("Review", ReviewSchema);
module.exports = ReviewModel;
