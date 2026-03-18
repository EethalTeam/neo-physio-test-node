const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    sessionCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },

    cycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TreatmentCycle",
      required: true,
      index: true,
    },

    physioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Physio",
      required: true,
    },

    sessionDate: {
      type: Date,
      required: true,
    },

    sessionDateTime: {
      type: Date,
      index: true,
    },

    sessionDay: {
      type: String,
      required: true,
    },

    sessionCancelReason: {
      type: String,
      trim: true,
      default: "",
    },

    sessionTime: {
      type: String,
      required: true,
    },

    sessionFromTime: {
      type: String,
      trim: true,
    },

    sessionToTime: {
      type: String,
      trim: true,
    },

    machineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Machine",
    },

    sessionStatusId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SessionStatus",
    },

    sessionFeedbackPros: {
      type: String,
      trim: true,
    },

    sessionFeedbackCons: {
      type: String,
      trim: true,
    },

    modeOfExercise: {
      type: String,
      trim: true,
    },

    redFlags: [
      {
        redFlagId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "RedFlag",
        },
        isOccurred: {
          type: Boolean,
          default: false,
        },
      },
    ],

    homeExerciseAssigned: {
      type: Boolean,
      default: false,
    },

    petrolAllowanceClaimed: {
      type: Boolean,
      default: true,
    },

    isPaid: {
      type: Boolean,
      default: false,
    },

    isBilled: {
      type: Boolean,
      default: false,
    },

    modalities: {
      type: Boolean,
      default: false,
    },

    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bill",
      default: null,
    },

    modalitiesList: [
      {
        modalityId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Modalitie",
        },
        isOccurred: {
          type: Boolean,
          default: false,
        },
      },
    ],

    targetArea: {
      type: String,
      trim: true,
    },

    sessionCount: {
      type: Number,
      required: true,
      default: 1,
    },

    monthlySessionCount: {
      type: Number,
      default: 1,
    },

    media: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

sessionSchema.index(
  { patientId: 1, cycleId: 1, sessionCount: 1 },
  { unique: true },
);

const SessionModel = mongoose.model("Session", sessionSchema);
module.exports = SessionModel;
