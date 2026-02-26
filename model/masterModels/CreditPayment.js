const mongoose = require("mongoose");
const creditPayment = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
    },
    BillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bill",
    },
    CreditAmount: {
      type: Number,
    },
    CreditDate: {
      type: Date,
    },
    CreditMonth: {
      type: Number,
    },
    CreditYear: {
      type: Number,
    },
    Creditdescription: {
      type: String,
      trim: true,
    },
    Creditfeedback: {
      type: String,
      trim: true,
    },
    Creditnotes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);
module.exports = mongoose.model("Credit", creditPayment);
