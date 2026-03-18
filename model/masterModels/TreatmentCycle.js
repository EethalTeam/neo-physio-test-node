const mongoose = require("mongoose");

const treatmentCycleSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },

    physioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Physio",
      required: true,
    },

    cycleNumber: {
      type: Number,
      required: true,
      default: 1,
    },

    cycleType: {
      type: String,
      enum: ["fresh", "continue"],
      required: true,
      default: "fresh",
    },

    cycleStatus: {
      type: String,
      enum: ["active", "recovered", "closed", "on-hold"],
      default: "active",
    },

    complaintSnapshot: {
      type: String,
      trim: true,
    },

    startDate: {
      type: Date,
      default: Date.now,
    },

    endDate: {
      type: Date,
      default: null,
    },

    totalSessions: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("TreatmentCycle", treatmentCycleSchema);
