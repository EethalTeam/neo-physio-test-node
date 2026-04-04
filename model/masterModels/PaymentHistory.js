const mongoose = require("mongoose");

const paymentHistorySchema = new mongoose.Schema(
  {
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bill",
      required: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    actionType: {
      type: String,
      enum: [
        "PAYMENT_RECEIVED",
        "PAYMENT_REVERTED",
        "PARTIAL_REVERTED",
        "DISCOUNT_ADDED",
        "BAD_DEBT_MARKED",
      ],
      required: true,
    },
    amount: {
      type: Number,
      default: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    beforeReceivedAmount: {
      type: Number,
      default: 0,
    },
    afterReceivedAmount: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      default: "",
    },
    createdBy: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("PaymentHistory", paymentHistorySchema);
