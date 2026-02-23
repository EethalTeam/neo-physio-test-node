const mongoose = require("mongoose");

// define Leave Schema
const LeaveSchema = new mongoose.Schema(
  {
    physioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Physio",
      required: true,
    },

    LeaveDate: {
      type: Date,
    },
    LeaveMode: {
      type: String,
    },
    PaidLeave: {
      type: Boolean,
      default: false,
    },
    SessionGenerateForLeave: [
      {
        patientId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Patient",
          // required: true,
        },
        sessionTime: {
          type: String,
        },
        Re_Assign: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Physio",
          default: null,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);
const LeaveModel = mongoose.model("Leave", LeaveSchema);
module.exports = LeaveModel;
