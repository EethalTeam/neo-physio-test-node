const mongoose = require("mongoose");

// Define the Machinery Schema
const machineSchema = new mongoose.Schema(
  {
    machineCode: {
      type: String,
      trim: true,
    },
    Assignedto: [
      {
        physioId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Physios",
        },
        count: {
          type: Number,
          trim: true,
        },
      },
    ],
    machineName: {
      type: String,
      trim: true,
    },
    machineCategoryID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MachineCategory",
    },
    machineDescription: {
      type: String,
      trim: true,
    },
    Manufacturer: {
      type: String,
      trim: true,
    },
    machineModel: {
      type: String,
      trim: true,
    },
    TotalStockCount: {
      type: Number,
      trim: true,
    },
    AvailableToAssign: {
      type: Number,
      trim: true,
    },
    StockInMaintanance: {
      type: Number,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    machineNote: {
      type: String,
      trim: true,
    },
    modalityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Modalitie",
    },
  },
  { timestamps: true },
);
const Machine = mongoose.model("Machine", machineSchema);
module.exports = Machine;
