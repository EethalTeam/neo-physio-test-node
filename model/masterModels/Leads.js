const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const leadSchema = new Schema(
  {
    leadName: {
      type: String,
      required: [true, "Lead name is required"],
      trim: true,
    },
    leadCode: {
      type: String,
      required: [false, "Lead code is required"],
      unique: false,
      trim: true,
    },
    leadAge: {
      type: Number,
      min: 0,
    },
    leadContactNo: {
      type: String,
      required: [true, "Contact number is required"],
      trim: true,
    },
    leadAddress: {
      type: String,
      trim: true,
    },
    leadGenderId: {
      type: Schema.Types.ObjectId,
      ref: "Gender",
    },
    physioCategoryId: {
      type: Schema.Types.ObjectId,
      ref: "PhysioCategory",
    },
    leadSourceId: {
      type: Schema.Types.ObjectId,
      ref: "LeadSource",
    },
    leadMedicalHistory: {
      type: String,
      trim: true,
    },
    isQualified: {
      type: Boolean,
      default: false,
    },
    ReferenceId: {
      type: Schema.Types.ObjectId,
      ref: "Reference",
      default: null,
    },
    LeadStatusId: {
      type: Schema.Types.ObjectId,
      ref: "LeadStatus",
      default: null,
    },
    cbDate: {
      type: Date,
      default: null,
    },
    leadDocuments: [
      {
        fileName: {
          type: String,
          required: true,
        },
        fileUrl: {
          type: String,
          required: true,
        },
        fileType: {
          type: String,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

const Lead = mongoose.model("Lead", leadSchema);

module.exports = Lead;
