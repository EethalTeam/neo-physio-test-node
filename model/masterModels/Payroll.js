const mongoose = require("mongoose");
const PayrollSchema = new mongoose.Schema(
  {
    physioId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    month: {
      type: String,
    },
    year: {
      type: Number,
    },
    Date: {
      type: Date,
      required: true,
    },
    completedSession: {
      type: Number,
    },
    cancelledSession: {
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
    amountperKm: {
      type: Number,
    },
  },
  { timestamps: true },
);
module.exports = mongoose.model("Payroll", PayrollSchema);
