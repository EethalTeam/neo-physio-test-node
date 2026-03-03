const mongoose = require("mongoose");

const petrolAllowanceSchema = new mongoose.Schema(
  {
    physioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Physio",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    completedKms: {
      type: Number,
      default: 0,
    },
    summary: [
      {
        patientId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Patient",
          required: true,
        },
        travelKm: {
          type: Number,
        },
      },
    ],
    canceledKms: {
      type: Number,
      default: 0,
      comment: "Kms travelled for sessions that were cancelled upon arrival",
    },
    manualKms: {
      type: Number,
      default: 0,
      comment: "Extra kms added manually for diversions or errands",
    },
    finalDailyKms: {
      type: Number,
      required: true,
      default: 0,
    },
    amountPerKm: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Paid"],
      default: "Pending",
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

petrolAllowanceSchema.index({ physioId: 1, date: 1 }, { unique: true });

const PetrolAllowanceModel = mongoose.model(
  "PetrolAllowance",
  petrolAllowanceSchema,
);
module.exports = PetrolAllowanceModel;
