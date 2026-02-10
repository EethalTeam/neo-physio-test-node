const mongoose = require("mongoose");

const RiskFactorSubSchema = new mongoose.Schema(
  {
    RiskFactorID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RiskFactor",
      required: true,
    },
    isExist: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

const patientSchema = new mongoose.Schema(
  {
    patientCode: {
      type: String,
      trim: true,
    },
    patientName: {
      type: String,
      trim: true,
    },
    consultationDate: {
      type: Date,
    },
    patientAge: {
      type: Number,
      trim: true,
    },
    patientGenderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gender",
    },
    isRecovered: {
      type: Boolean,
      default: false,
    },
    recoveredAt: {
      type: Date,
      default: null,
    },

    stopReason: {
      type: String,
      trim: true,
    },
    recoveredType: {
      type: String,
      trim: true,
    },
    isConsentReceived: {
      type: Boolean,
      default: false,
    },
    byStandar: {
      type: String,
      trim: true,
    },
    Relation: {
      type: String,
      trim: true,
    },
    patientNumber: {
      type: Number,
      trim: true,
    },
    patientAltNum: {
      type: Number,
      trim: true,
    },
    patientAddress: {
      type: String,
      trim: true,
    },
    patientPinCode: {
      type: String,
      trim: true,
    },
    patientCondition: {
      type: String,
      trim: true,
    },
    physioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Physio",
    },
    reviewDate: {
      type: Date,
    },
    MedicalHistoryAndRiskFactor: [RiskFactorSubSchema],

    otherMedCon: {
      type: String,
      trim: true,
    },
    currMed: {
      type: String,
      trim: true,
    },
    typesOfLifeStyle: {
      type: String,
      trim: true,
    },
    smokingOrAlcohol: {
      type: Boolean,
      default: false,
    },
    dietaryHabits: {
      type: String,
      trim: true,
    },
    Contraindications: {
      type: String,
      trim: true,
    },
    painLevel: {
      type: Number,
    },

    rangeOfMotion: {
      type: String,
      trim: true,
    },

    muscleStrength: {
      type: String,
      trim: true,
    },
    postureOrGaitAnalysis: {
      type: String,
      trim: true,
    },

    static: {
      type: String,
      trim: true,
    },
    dynamic: {
      type: String,
      trim: true,
    },
    coordination: {
      type: String,
      trim: true,
    },
    functionalLimitations: {
      type: String,
      trim: true,
    },
    ADLAbility: {
      type: String,
      trim: true,
    },
    shortTermGoals: {
      type: String,
      trim: true,
    },
    longTermGoals: {
      type: String,
      trim: true,
    },
    RecomTherapy: {
      type: String,
      trim: true,
    },
    Frequency: {
      type: Number,
      trim: true,
    },
    Duration: {
      type: String,
      trim: true,
    },
    noOfDays: {
      type: Number,
    },
    Modalities: {
      type: Boolean,
      default: false,
    },
    targetedArea: {
      type: String,
      trim: true,
    },
    hodNotes: {
      type: String,
      trim: true,
    },
    Physiotherapist: {
      type: String,
      trim: true,
    },
    sessionStartDate: {
      type: Date,
      trim: true,
    },

    sessionTime: {
      type: String,
      trim: true,
    },
    totalSessionDays: {
      type: Number,
      trim: true,
    },
    InitialShorttermGoal: {
      type: String,
      trim: true,
    },
    goalDuration: {
      type: Number,
      trim: true,
    },
    visitOrder: {
      type: Number,
      trim: true,
    },
    KmsfromHub: {
      type: Number,
      trim: true,
    },
    KmsfLPatienttoHub: {
      type: Number,
      trim: true,
    },
    kmsFromPrevious: {
      type: Number,
      trim: true,
    },
    Feedback: {
      type: String,
      trim: true,
    },
    Satisfaction: {
      type: Number,
      min: 0,
      max: 100,
    },
    goalLog: [
      {
        goal: {
          type: String,
          required: false,
        },
        feedback: {
          type: String,
        },
        satisfaction: {
          type: Number,
        },
        status: {
          type: String,
        },
        date: {
          type: String,
        },
        goalDuration: {
          type: Number,
        },
      },
    ],

    historyOfFall: {
      type: Boolean,
      default: false,
    },
    historyOfSurgery: {
      type: Boolean,
      default: false,
    },
    historyOfSurgeryDetails: {
      type: String,
      trim: true,
    },
    historyOfFallDetails: {
      type: String,
      trim: true,
    },
    reviewFrequency: {
      type: Number,
      trim: true,
    },
    goalDescription: {
      type: String,
      trim: true,
    },
    FeesTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeesType",
    },
    feeAmount: {
      type: Number,
      trim: true,
    },
    ReferenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reference",
    },
  },
  { timestamps: true },
);
const PatientModel = mongoose.model("Patient", patientSchema);
module.exports = PatientModel;
