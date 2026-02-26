const mongoose = require("mongoose");
const PayrollSchema = new mongoose.Schema(
  {
    physioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Physio",
      required: true,
    },
    payrRollMonth: {
      type: String,
    },
    payrRollYear: {
      type: Number,
    },
    payRollDate: {
      type: Date,
      required: true,
    },
    payrRollCompletedSessions: {
      type: Number,
    },
    payrRollCancelledSession: {
      type: Number,
    },
    PetrolKm: {
      type: Number,
    },
    PetrolAmount: {
      type: Number,
    },
    basicSalary: {
      type: Number,
    },
    vehicleMaintanance: {
      type: Number,
    },
    ESI: {
      type: Number,
    },
    PF: {
      type: Number,
    },
    Incentive: {
      type: Number,
    },
    NetSalary: {
      type: Number,
    },
    NoofLeave: {
      type: Number,
    },
    TotalSalary: {
      Type: Number,
    },
    TotalAmountDeducted: {
      Type: Number,
    },
    amountperKm: {
      type: Number,
    },
  },
  { timestamps: true },
);
module.exports = mongoose.model("Payroll", PayrollSchema);
