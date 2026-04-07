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
    ManualDeduction: { type: Number, default: 0 },
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
    savings: {
      type: Number,
    },
    NoofLeave: {
      type: Number,
    },
    totalWorkingDays: { type: Number, default: 0 },
    attendedDays: { type: Number, default: 0 },
    TotalSalary: {
      type: Number,
    },
    TotalAmountDeducted: {
      type: Number,
    },
    amountperKm: {
      type: Number,
    },
    NoofLeave: { type: Number, default: 0 }, // unpaid leaves (for deduction)
    PaidLeaves: { type: Number, default: 0 }, // optional info
    TotalLeaves: { type: Number, default: 0 },
  },
  { timestamps: true },
);
module.exports = mongoose.model("Payroll", PayrollSchema);
