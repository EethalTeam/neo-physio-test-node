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
    paymentType: {
      type: String,
      required: true,
    },
    ReceivedAmount: {
      type: Number,
    },
    BilledAmount: {
      type: Number,
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
    TotalSessionCount: { type: Number },
  },
  {
    timestamps: true,
  },
);

const BillSchema = mongoose.model("Bill", billSchema);
module.exports = BillSchema;
