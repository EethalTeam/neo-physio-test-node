const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    sessionCode: {
      type: String,
      required: true,
      unique: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
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
    },
    sessionTime: {
      type: String,
      required: true,
    },
    sessionFromTime: {
      type: String,
    },
    sessionToTime: {
      type: String,
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
    // Red Flags Array
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
    sessionCount: { type: Number },
    media: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

const SessionModel = mongoose.model("Session", sessionSchema);
module.exports = SessionModel;
