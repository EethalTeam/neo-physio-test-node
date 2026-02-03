const mongoose = require("mongoose");

const physioSChema = new mongoose.Schema(
  {
    physioCode: {
      type: String,
      trim: true,
    },
    physioPic: {
      type: String,
      trim: true,
      default: "",
    },
    EmpCode: {
      type: String,
      trim: true,
    },
    physioName: {
      type: String,
      trim: true,
      required: true,
    },
    // physioAge: {
    //     type: String,
    //     trim: true,
    //     required: true,
    // },
    physioDob: {
      type: Date,
      required: true,
    },
    physioGenderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gender",
    },
    physioContactNo: {
      type: String,
      trim: true,
      required: true,
    },
    physioAltno: {
      type: String,
      trim: true,
      required: false,
    },
    physioAltno2: {
      type: String,
      trim: true,
      required: false,
    },
    physiorelationAltno2: {
      type: String,
      trim: true,
      required: false,
    },
    physiorelationAltno: {
      type: String,
      trim: true,
      required: false,
    },
    physioSpcl: {
      type: String,
      trim: true,
      required: true,
    },
    physioQulifi: {
      type: String,
      trim: true,
      required: true,
    },
    physioExp: {
      type: String,
      trim: true,
      required: true,
    },
    physioPAN: {
      type: String,
      trim: true,
      required: true,
    },
    physioAadhar: {
      type: String,
      trim: true,
      required: true,
    },
    physioSalary: {
      type: Number,
      required: true,
      trim: true,
    },
    physioProbation: {
      type: Number,
      required: true,
      trim: true,
    },
    physioINCRDate: {
      type: Date,
      required: true,
    },
    physioPetrolAlw: {
      type: Number,
      required: true,
      trim: true,
    },
    physioVehicleMTC: {
      type: Number,
      required: true,
      trim: true,
    },
    physioIncentive: {
      type: Number,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    physioNote: {
      type: String,
      trim: true,
    },
    physioDescription: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      trim: true,
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RoleBased", // master table
      required: false,
    },
  },
  {
    timestamps: true,
  },
);

const Physio = mongoose.model("Physio", physioSChema);
module.exports = Physio;