const mongoose = require("mongoose");

const billSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    physioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Physio",
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    ToDate: {
      type: Date,
      required: true,
    },
    ratePerSession: {
      type: Number,
    },
    totalAmount: {
      type: Number,
    },
    month: {
      type: String,
    },
    year: {
      type: Number,
    },
    sessionCount: { type: Number },
  },
  {
    timestamps: true,
  },
);

const BillSchema = mongoose.model("Bill", billSchema);
module.exports = BillSchema;
