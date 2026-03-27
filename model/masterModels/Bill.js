const mongoose = require("mongoose");

const billSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    invoiceNo: {
      type: Number,
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
      default: 0,
    },
    ReceivedAmount: {
      type: Number,
      default: 0,
    },
    TotalBilledAmount: {
      type: Number,
      default: 0,
    },
    DeductedFromAdvance: {
      type: Number,
      default: 0,
    },
    NetBilledAmount: {
      type: Number,
      default: 0,
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
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    month: {
      type: String,
    },
    year: {
      type: Number,
    },
    TotalSessionCount: {
      type: Number,
      default: 0,
    },
    feeType: {
      type: String,
      enum: ["permonth", "persession"],
      default: "persession",
    },
  },
  {
    timestamps: true,
  },
);

const BillSchema = mongoose.model("Bill", billSchema);
module.exports = BillSchema;
