const mongoose = require("mongoose");
const DebitPayment = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
    },
    DebitAmount: {
      type: Number,
    },
    DebitDate: {
      type: Date,
    },
    DebitMonth: {
      type: Number,
    },
    DebitYear: {
      type: Number,
    },
    Debitdescription: {
      type: String,
      trim: true,
    },
    Debitfeedback: {
      type: String,
      trim: true,
    },
    Debitnotes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);
module.exports = mongoose.model("Debit", DebitPayment);
