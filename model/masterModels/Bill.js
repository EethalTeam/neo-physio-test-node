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
      enum: [
        "Full Payment",
        "Partial Payment",
        "Discount",
        "Bad Debt",
        "Pending",
      ],
      default: "Pending",
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Partially Paid", "Paid", "Bad Debt"],
      default: "Pending",
    },
    isBadDebt: {
      type: Boolean,
      default: false,
    },
    DiscountAmount: {
      type: Number,
    },
    ReceivedAmount: {
      type: Number,
    },
    TotalBilledAmount: {
      type: Number,
    },
    DeductedFromAdvance: {
      type: Number,
    },
    NetBilledAmount: {
      type: Number,
    },
    isComplete: {
      type: Boolean,
      default: false,
    },
    startDate: {
      type: Date,
      required: true,
    },
    ToDate: {
      type: Date,
      required: true,
    },
    isSend: {
      type: Boolean,
      default: false,
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
