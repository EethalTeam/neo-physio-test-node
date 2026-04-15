const mongoose = require("mongoose");
const Patient = require("../../model/masterModels/Patient");
const Session = require("../../model/masterModels/Session");
const Counter = require("../../model/masterModels/Counter");
const SessionModel = require("../../model/masterModels/Session");
const Bill = require("../../model/masterModels/Bill");
const Debit = require("../../model/masterModels/DebitPayment");
const TreatmentCycle = require("../../model/masterModels/TreatmentCycle");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const toBoolean = (val, defaultVal = false) => {
  if (val === true || val === "true") return true;
  if (val === false || val === "false") return false;
  if (val === "" || val === undefined || val === null) return defaultVal;
  return Boolean(val);
};

const toNullableObjectId = (value) => {
  return value && value !== "" ? value : null;
};
const uploadDir = "uploads/patients";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(
      null,
      `patient-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(
        file.originalname,
      )}`,
    );
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    return cb(null, true);
  }

  cb(
    new Error(
      "Only jpg, jpeg, png, pdf, doc, docx, xls, xlsx files are allowed!",
    ),
  );
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
}).array("patientDocuments", 10);

exports.patientUploadMiddleware = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        message:
          err.code === "LIMIT_FILE_SIZE"
            ? "File too large (Max 50MB)"
            : err.message,
      });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};
exports.fixPatientActiveCycle = async (req, res) => {
  try {
    const patients = await Patient.find({});
    let updated = 0;

    for (const patient of patients) {
      // 🔥 find latest ACTIVE cycle always
      const cycle = await TreatmentCycle.findOne({
        patientId: patient._id,
        cycleStatus: "active",
      }).sort({ createdAt: -1 });

      if (!cycle) {
        continue;
      }

      // 🔥 update if mismatch OR null
      if (
        !patient.activeCycleId ||
        patient.activeCycleId.toString() !== cycle._id.toString()
      ) {
        patient.activeCycleId = cycle._id;
        await patient.save();

        updated++;
      }
    }

    return res.status(200).json({
      success: true,
      message: "ActiveCycleId corrected",
      updated,
    });
  } catch (err) {
    console.error("Fix error:", err);
    res.status(500).json({ message: err.message });
  }
};
exports.debugPatientCycles = async (req, res) => {
  try {
    const patients = await Patient.find({});

    const result = [];

    for (const patient of patients) {
      const activeCycle = await TreatmentCycle.findOne({
        patientId: patient._id,
        cycleStatus: "active",
      }).sort({ createdAt: -1 });

      result.push({
        patientId: patient._id,
        patientName: patient.patientName,
        currentActiveCycleId: patient.activeCycleId || null,
        foundActiveCycleId: activeCycle?._id || null,
        foundCycleStatus: activeCycle?.cycleStatus || null,
      });
    }

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.fixOldSessionsAndCycle = async (req, res) => {
  try {
    const patients = await Patient.find({});
    let created = 0;
    let updatedSessions = 0;
    let assigned = 0;

    for (const patient of patients) {
      // find old sessions (without cycle)
      const sessions = await Session.find({
        patientId: patient._id,
        $or: [{ cycleId: null }, { cycleId: { $exists: false } }],
      });

      // find or create cycle
      let cycle = await TreatmentCycle.findOne({
        patientId: patient._id,
        cycleStatus: "active",
      });

      if (!cycle) {
        cycle = await TreatmentCycle.create({
          patientId: patient._id,
          physioId: patient.physioId,
          cycleNumber: 1,
          cycleType: "continue", // 🔥 important
          cycleStatus: "active",
          startDate:
            patient.sessionStartDate || patient.createdAt || new Date(),
        });

        created++;
      }

      // 🔥 attach old sessions to this cycle
      if (sessions.length > 0) {
        await Session.updateMany(
          { _id: { $in: sessions.map((s) => s._id) } },
          { $set: { cycleId: cycle._id } },
        );

        updatedSessions += sessions.length;
      }

      // assign active cycle
      if (!patient.activeCycleId) {
        patient.activeCycleId = cycle._id;
        await patient.save();
        assigned++;
      }
    }

    return res.status(200).json({
      success: true,
      message: "Old sessions linked with cycle successfully",
      createdCycles: created,
      updatedSessions,
      assignedPatients: assigned,
    });
  } catch (err) {
    console.error("Fix error:", err);
    res.status(500).json({ message: err.message });
  }
};
// Create a new Patient
exports.createPatients = async (req, res) => {
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    const {
      patientName,
      isActive,
      consultationDate,
      historyOfFall,
      historyOfSurgery,
      historyOfSurgeryDetails,
      historyOfFallDetails,
      patientAge,
      patientGenderId,
      byStandar,
      Relation,
      patientNumber,
      patientAltNum,
      patientAddress,
      patientPinCode,
      patientCondition,
      physioId,
      reviewDate,
      MedicalHistoryAndRiskFactor,
      otherMedCon,
      currMed,
      typesOfLifeStyle,
      smokingOrAlcohol,
      dietaryHabits,
      Contraindications,
      painLevel,
      rangeOfMotion,
      muscleStrength,
      postureOrGaitAnalysis,
      functionalLimitations,
      static,
      dynamic,
      coordination,
      ADLAbility,
      shortTermGoals,
      goalDescription,
      longTermGoals,
      RecomTherapy,
      Frequency,
      Duration,
      noOfDays,
      modalities,
      targetedArea,
      hodNotes,
      Physiotherapist,
      sessionStartDate,
      sessionTime,
      totalSessionDays,
      InitialShorttermGoal,
      goalDuration,
      visitOrder,
      KmsfromHub,
      KmsfLPatienttoHub,
      Feedback,
      Satisfaction,
      kmsFromPrevious,
      reviewFrequency,
      FeesTypeId,
      feeAmount,
      ReferenceId,
    } = req.body;

    const existingPatient = await Patient.findOne({
      patientNumber: patientNumber,
    }).session(dbSession);

    if (existingPatient) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return res.status(200).json({
        success: false,
        message: "EXISTING_NUMBER",
      });
    }

    const lastHnpPatient = await Patient.find({
      patientCode: { $regex: /^HNP/ },
    })
      .sort({ createdAt: -1 })
      .limit(1)
      .session(dbSession);

    let nextId = 1;
    if (lastHnpPatient.length > 0) {
      nextId =
        parseInt(lastHnpPatient[0].patientCode.replace("HNP", ""), 10) + 1;
    }

    const newHnpCode = `HNP${String(nextId).padStart(6, "0")}`;
    let patientDocuments = [];

    if (req.files && req.files.length > 0) {
      patientDocuments = req.files.map((file) => ({
        fileName: file.originalname,
        fileUrl: `/uploads/patients/${file.filename}`,
        fileType: file.mimetype,
      }));
    }
    let safeMedicalHistory = MedicalHistoryAndRiskFactor;

    if (!safeMedicalHistory || typeof safeMedicalHistory !== "object") {
      safeMedicalHistory = {};
    }

    console.log(
      "MedicalHistoryAndRiskFactor received:",
      MedicalHistoryAndRiskFactor,
    );
    console.log("MedicalHistoryAndRiskFactor used:", safeMedicalHistory);
    const createData = {
      patientName,
      patientCode: newHnpCode,
      isActive,
      consultationDate,
      historyOfFall,
      historyOfSurgery,
      historyOfSurgeryDetails,
      historyOfFallDetails,
      patientAge,
      patientGenderId,
      byStandar,
      Relation,
      patientNumber,
      patientAltNum,
      patientAddress,
      patientPinCode,
      patientCondition,
      reviewDate,
      MedicalHistoryAndRiskFactor: safeMedicalHistory,
      otherMedCon,
      currMed,
      typesOfLifeStyle,
      smokingOrAlcohol,
      dietaryHabits,
      Contraindications,
      painLevel,
      rangeOfMotion,
      muscleStrength,
      postureOrGaitAnalysis,
      functionalLimitations,
      static,
      dynamic,
      coordination,
      ADLAbility,
      shortTermGoals,
      goalDescription,
      longTermGoals,
      RecomTherapy,
      Frequency,
      Duration,
      noOfDays,
      modalities,
      targetedArea,
      hodNotes,
      Physiotherapist,
      sessionStartDate,
      sessionTime,
      totalSessionDays,
      InitialShorttermGoal,
      goalDuration,
      visitOrder,
      KmsfromHub,
      KmsfLPatienttoHub,
      Feedback,
      Satisfaction,
      kmsFromPrevious,
      reviewFrequency,
      feeAmount,
      patientDocuments,
    };

    if (ReferenceId) createData.ReferenceId = ReferenceId;
    if (FeesTypeId) createData.FeesTypeId = FeesTypeId;
    if (physioId) createData.physioId = physioId;

    const patients = new Patient(createData);
    await patients.save({ session: dbSession });

    const cycle = await TreatmentCycle.create(
      [
        {
          patientId: patients._id,
          physioId: physioId || null,
          cycleNumber: 1,
          cycleType: "fresh",
          cycleStatus: "active",
        },
      ],
      { session: dbSession },
    );

    patients.activeCycleId = cycle[0]._id;
    await patients.save({ session: dbSession });

    await dbSession.commitTransaction();
    dbSession.endSession();

    res.status(200).json({
      success: true,
      message: "Patient created successfully",
      data: patients._id,
      activeCycleId: cycle[0]._id,
    });
  } catch (error) {
    await dbSession.abortTransaction();
    dbSession.endSession();
    res.status(500).json({ message: error.message });
  }
};
exports.startFreshCycle = async (req, res) => {
  const dbSession = await mongoose.startSession();

  try {
    dbSession.startTransaction();

    const { patientId, physioId } = req.body;

    if (!patientId) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return res.status(400).json({
        success: false,
        message: "Patient id is required",
      });
    }

    const patient = await Patient.findById(patientId).session(dbSession);

    if (!patient) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    const lastCycle = await TreatmentCycle.findOne({ patientId })
      .sort({ cycleNumber: -1 })
      .session(dbSession);

    const nextCycleNumber = lastCycle ? lastCycle.cycleNumber + 1 : 1;

    const newCycle = await TreatmentCycle.create(
      [
        {
          patientId,
          physioId: physioId || patient.physioId || null,
          cycleNumber: nextCycleNumber,
          cycleType: "fresh",
          cycleStatus: "active",
        },
      ],
      { session: dbSession },
    );

    const updatedPatient = await Patient.findByIdAndUpdate(
      patientId,
      {
        $set: {
          activeCycleId: newCycle[0]._id,
          physioId: physioId || patient.physioId || null,
          isRecovered: false,
          recoveredAt: null,
          stopReason: null,
          recoveredType: null,
        },
      },
      {
        new: true,
        session: dbSession,
      },
    );

    await dbSession.commitTransaction();
    dbSession.endSession();

    return res.status(200).json({
      success: true,
      message: "Fresh cycle started successfully",
      cycle: newCycle[0],
      patient: updatedPatient,
    });
  } catch (error) {
    await dbSession.abortTransaction();
    dbSession.endSession();
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
exports.continueOldCycle = async (req, res) => {
  const dbSession = await mongoose.startSession();

  try {
    dbSession.startTransaction();

    const { patientId } = req.body;

    if (!patientId) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return res.status(400).json({
        success: false,
        message: "Patient id is required",
      });
    }

    const patient = await Patient.findById(patientId).session(dbSession);

    if (!patient) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    const lastCycle = await TreatmentCycle.findOne({ patientId })
      .sort({ cycleNumber: -1 })
      .session(dbSession);

    if (!lastCycle) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return res.status(404).json({
        success: false,
        message: "No old cycle found",
      });
    }

    await TreatmentCycle.updateOne(
      { _id: lastCycle._id },
      {
        $set: {
          cycleStatus: "active",
          endDate: null,
        },
      },
      { session: dbSession },
    );

    const updatedPatient = await Patient.findByIdAndUpdate(
      patientId,
      {
        $set: {
          activeCycleId: lastCycle._id,
          isRecovered: false,
          recoveredAt: null,
          stopReason: null,
          recoveredType: null,
        },
      },
      {
        new: true,
        session: dbSession,
      },
    );

    await dbSession.commitTransaction();
    dbSession.endSession();

    return res.status(200).json({
      success: true,
      message: "Old cycle continued successfully",
      cycle: lastCycle,
      patient: updatedPatient,
    });
  } catch (error) {
    await dbSession.abortTransaction();
    dbSession.endSession();
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// Get all Patient
// exports.getAllPatients = async (req, res) => {
//   // Replace all old CON codes sequentially (one-time, in-place)
//   try {
//     const conPatients = await Patient.find({
//       patientCode: { $regex: /^CON/ },
//     }).sort({ createdAt: 1 });
//     if (conPatients.length > 0) {
//       let counter = 1;
//       for (const patient of conPatients) {
//         patient.patientCode = `HNP${String(counter).padStart(6, "0")}`;
//         await patient.save();
//         counter++;
//       }
//     }

//     // try {
//     const Patients = await Patient.find()
//       .populate("FeesTypeId", "feesTypeName")
//       .populate("patientGenderId", "genderName")
//       .populate("MedicalHistoryAndRiskFactor.RiskFactorID", "RiskFactorName")
//       .populate("physioId", "physioName");
//     if (!Patients) {
//       res.status(400).json({ message: "patients is not found" });
//     }
//     const response = Patients.map((p) => ({
//       ...p._doc,
//       FeesTypeName: p.FeesTypeId?.feesTypeName || "N/A", // add this field
//     }));
//     res.status(200).json(response);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

exports.getAllPatients = async (req, res) => {
  try {
    const { targetDate, view } = req.body;

    const conPatients = await Patient.find({
      patientCode: { $regex: /^CON/ },
    }).sort({ createdAt: 1 });

    if (conPatients.length > 0) {
      let counter = 1;
      for (const patient of conPatients) {
        patient.patientCode = `HNP${String(counter).padStart(6, "0")}`;
        await patient.save();
        counter++;
      }
    }

    let patientFilter = {};

    if (view === "recovered") {
      patientFilter.isRecovered = true;
    } else if (view === "active") {
      patientFilter.isRecovered = { $ne: true };
    }

    if (targetDate) {
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const sessions = await Session.find({
        sessionDate: { $gte: startOfDay, $lte: endOfDay },
      }).select("patientId");

      const patientIds = [
        ...new Set(sessions.map((s) => s.patientId.toString())),
      ];

      patientFilter._id = { $in: patientIds };
    }

    const patients = await Patient.find(patientFilter)
      .populate("FeesTypeId", "feesTypeName")
      .populate("patientGenderId", "genderName")
      .populate("MedicalHistoryAndRiskFactor.RiskFactorID", "RiskFactorName")
      .populate("physioId", "physioName")
      .populate("ReferenceId", "sourceName")
      .sort({ createdAt: -1 });

    if (!patients || patients.length === 0) {
      return res.status(200).json([]);
    }

    const COMPLETED_STATUS_ID = new mongoose.Types.ObjectId(
      "691ec69eae0e10763c8f21e0",
    );

    const sessionCountMap = {};
    const totalSessionCountMap = {};
    for (const p of patients) {
      let count = 0;
      let totalSessionCount = 0;

      if (p.activeCycleId) {
        count = await Session.countDocuments({
          patientId: p._id,
          sessionStatusId: COMPLETED_STATUS_ID,
          isBilled: { $ne: true },
        });
        totalSessionCount = await Session.countDocuments({
          patientId: p._id,
          sessionStatusId: COMPLETED_STATUS_ID,
        });
      } else {
        count = await Session.countDocuments({
          patientId: p._id,
          sessionStatusId: COMPLETED_STATUS_ID,
          isBilled: { $ne: true },
        });
        totalSessionCount = await Session.countDocuments({
          patientId: p._id,
          sessionStatusId: COMPLETED_STATUS_ID,
        });
      }

      sessionCountMap[p._id.toString()] = count;
      totalSessionCountMap[p._id.toString()] = totalSessionCount;
    }
    const response = patients.map((p) => ({
      ...p._doc,
      FeesTypeName: p.FeesTypeId?.feesTypeName || "N/A",
      sessionCount: sessionCountMap[p._id.toString()] || 0,
      totalSessionCount: totalSessionCountMap[p._id.toString()] || 0,
    }));

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error in getAllPatients:", error);
    return res.status(500).json({ message: error.message });
  }
};

exports.getAllPatientsByPhysioAndDate = async (req, res) => {
  try {
    const { physioId, targetDate } = req.body; // targetDate isn't strictly needed for this version

    // Directly find patients whose main doctor is the one selected
    const patients = await Patient.find({
      physioId: new mongoose.Types.ObjectId(physioId),
      isRecovered: { $ne: true },
    })
      .populate("FeesTypeId", "feesTypeName")
      .populate("physioId", "physioName")
      .lean();

    const response = patients.map((p) => ({
      ...p,
      FeesTypeName: p.FeesTypeId?.feesTypeName || "N/A",
      sessionTime: p.sessionTime || "Not Scheduled",
    }));

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getIncomeByDate = async (req, res) => {
  try {
    let { fromDate, toDate } = req.body;

    if (fromDate && !toDate) toDate = fromDate;

    const startDate = fromDate
      ? new Date(fromDate + "T00:00:00.000Z")
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const endDate = fromDate
      ? new Date(toDate + "T23:59:59.999Z")
      : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

    // Use your existing income logic API if you already have it
    const patients = await Patient.find().populate(
      "FeesTypeId",
      "feesTypeName",
    );

    const result = await Promise.all(
      patients.map(async (p) => {
        const sessions = await Session.find({
          patientId: p._id,
          sessionDate: { $gte: startDate, $lte: endDate },
        }).populate("sessionStatusId", "sessionStatusName");

        const completed = sessions.filter(
          (s) =>
            s.sessionStatusId?.sessionStatusName?.toLowerCase() === "completed",
        ).length;

        const feeTypeName = p.FeesTypeId?.feesTypeName || "N/A";
        const baseFee = Number(p.feeAmount || 0);

        let feePerSession = 0;
        if (feeTypeName === "PerSession") feePerSession = baseFee;
        else if (feeTypeName === "PerMonth") feePerSession = baseFee / 26;

        const totalIncome = Number((completed * feePerSession).toFixed(2));

        return {
          _id: p._id,
          patientName: p.patientName,
          feeType: feeTypeName,
          feePerSession: Number(feePerSession.toFixed(2)),
          totalCompletedSessions: completed,
          totalIncome,
        };
      }),
    );

    const totalIncome = result.reduce(
      (sum, p) => sum + (p.totalIncome || 0),
      0,
    );

    return res.status(200).json({
      totalIncome: Number(totalIncome.toFixed(2)),
      patients: result,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// exports.getAllPatientsIncome = async (req, res) => {
//   try {
//     const { month, year } = req.body;
//     if (!month || !year) {
//       return res.status(400).json({ message: "Month and Year are required." });
//     }

//     const patients = await Patient.find()
//       .populate("FeesTypeId", "feesTypeName") // Correct field
//       .populate("patientGenderId", "genderName")
//       .populate("MedicalHistoryAndRiskFactor.RiskFactorID", "RiskFactorName")
//       .populate("physioId", "physioName");

//     const result = await Promise.all(
//       patients.map(async (p) => {
//         // Fetch sessions for the selected month
//         const sessions = await Session.find({
//           patientId: p._id,
//           sessionDate: {
//             $gte: new Date(year, month - 1, 1),
//             $lt: new Date(year, month, 1),
//           },
//         });

//         // Filter completed sessions
//         const completedSessions = sessions.filter(
//           (s) =>
//             s.sessionStatusId?.sessionStatusName &&
//             s.sessionStatusId.sessionStatusName.toLowerCase() === "completed",
//         );

//         const totalCompleted = completedSessions.length;

//         // Calculate total income
//         let totalIncome = 0;
//         const feeTypeName = p.FeesTypeId?.feesTypeName;

//         if (feeTypeName === "PerSession") {
//           totalIncome = (p.feeAmount || 0) * totalCompleted;
//         } else if (feeTypeName === "Monthly") {
//           totalIncome = p.feeAmount || 0;
//         }

//         return {
//           _id: p._id,
//           patientName: p.patientName,
//           feeType: feeTypeName || "N/A",
//           feePerSession: p.feeAmount || 0,
//           totalCompletedSessions: totalCompleted,
//           totalIncome,
//         };
//       }),
//     );

//     res.status(200).json(result);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: error.message });
//   }
// };

// exports.getAllPatientsIncome = async (req, res) => {
//   try {
//     const { month, year } = req.body;
//     if (!month || !year) {
//       return res.status(400).json({ message: "Month and Year are required." });
//     }

//     const patients = await Patient.find()
//       .populate("FeesTypeId", "feesTypeName")
//       .populate("patientGenderId", "genderName")
//       .populate("MedicalHistoryAndRiskFactor.RiskFactorID", "RiskFactorName")
//       .populate("physioId", "physioName");

//     const result = await Promise.all(
//       patients.map(async (p) => {
//         const sessions = await Session.find({
//           patientId: p._id,
//           sessionDate: {
//             $gte: new Date(year, month - 1, 1),
//             $lt: new Date(year, month, 1),
//           },
//         }).populate("sessionStatusId", "sessionStatusName");

//         const completedSessions = sessions.filter(
//           (s) =>
//             s.sessionStatusId?.sessionStatusName &&
//             s.sessionStatusId.sessionStatusName.toLowerCase() === "completed",
//         );
//         const NonbilledSessions = sessions.filter(
//           (s) =>
//             s.sessionStatusId?.sessionStatusName &&
//             s.sessionStatusId.sessionStatusName.toLowerCase() === "completed" &&
//             (s.isBilled === false || s.isBilled === undefined),
//         );
//         const billedSessions = sessions.filter(
//           (s) =>
//             s.sessionStatusId?.sessionStatusName &&
//             s.sessionStatusId.sessionStatusName.toLowerCase() === "completed" &&
//             s.isBilled === true,
//         );
//         const totalCompleted = completedSessions.length;
//         const totalNonBilled = NonbilledSessions.length;
//         const totalBilled = billedSessions.length;
//         let totalIncome = 0;
//         let Billed = 0;
//         let NonBilled = 0;
//         const feeTypeName = p.FeesTypeId?.feesTypeName;
//         const baseFee = p.feeAmount || 0;

//         if (feeTypeName === "PerSession") {
//           totalIncome = baseFee * totalCompleted;
//           Billed = baseFee * totalBilled;
//           NonBilled = baseFee * totalNonBilled;
//         } else if (feeTypeName === "PerMonth") {
//           const ratePerSession = baseFee / 26;
//           totalIncome = ratePerSession * totalCompleted;
//           Billed = ratePerSession * totalBilled;
//           NonBilled = ratePerSession * totalNonBilled;
//         }

//         return {
//           _id: p._id,
//           patientName: p.patientName,
//           physioName: p.physioId?.physioName,
//           physioId: p.physioId?._id,
//           feeType: feeTypeName || "N/A",
//           feePerSession:
//             feeTypeName === "PerMonth" ? (baseFee / 26).toFixed(2) : baseFee,
//           totalCompletedSessions: totalCompleted,
//           totalIncome: Number(totalIncome.toFixed(2)),
//           totalBilled: totalBilled,
//           totalNonBilled: totalNonBilled,
//           Billed: Number(Billed.toFixed(2)),
//           NonBilled: Number(NonBilled.toFixed(2)),
//         };
//       }),
//     );
//     res.status(200).json(result);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: error.message });
//   }
// };

exports.getAllPatientsIncome = async (req, res) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) {
      return res.status(400).json({ message: "Month and Year are required." });
    }

    const patients = await Patient.find()
      .populate("FeesTypeId", "feesTypeName")
      .populate("patientGenderId", "genderName")
      .populate("MedicalHistoryAndRiskFactor.RiskFactorID", "RiskFactorName")
      .populate("physioId", "physioName");

    const result = await Promise.all(
      patients.map(async (p) => {
        const sessions = await Session.find({
          patientId: p._id,
          sessionDate: {
            $gte: new Date(year, month - 1, 1),
            $lt: new Date(year, month, 1),
          },
        })
          .populate("sessionStatusId", "sessionStatusName")
          .populate("physioId", "physioName");

        // 1. Get all completed sessions first
        const completedSessions = sessions.filter(
          (s) =>
            s.sessionStatusId?.sessionStatusName &&
            s.sessionStatusId.sessionStatusName.toLowerCase() === "completed",
        );

        // --- NEW LOGIC: Count Sessions per Physio ---
        const physioMap = {};

        completedSessions.forEach((s) => {
          if (s.physioId) {
            const id = s.physioId._id.toString();
            if (!physioMap[id]) {
              physioMap[id] = {
                physioId: id,
                physioName: s.physioId.physioName,
                sessionCount: 0,
              };
            }
            physioMap[id].sessionCount += 1;
          }
        });

        // Convert the map back into an array for the response
        const physioDetails = Object.values(physioMap);
        // --------------------------------------------

        const NonbilledSessions = completedSessions.filter(
          (s) => s.isBilled === false || s.isBilled === undefined,
        );
        const billedSessions = completedSessions.filter(
          (s) => s.isBilled === true,
        );

        const totalCompleted = completedSessions.length;
        const totalNonBilled = NonbilledSessions.length;
        const totalBilled = billedSessions.length;

        let totalIncome = 0;
        let Billed = 0;
        let NonBilled = 0;

        const feeTypeName = p.FeesTypeId?.feesTypeName;
        const baseFee = p.feeAmount || 0;

        if (feeTypeName === "PerSession") {
          totalIncome = baseFee * totalCompleted;
          Billed = baseFee * totalBilled;
          NonBilled = baseFee * totalNonBilled;
        } else if (feeTypeName === "PerMonth") {
          const ratePerSession = baseFee / 26;
          totalIncome = ratePerSession * totalCompleted;
          Billed = ratePerSession * totalBilled;
          NonBilled = ratePerSession * totalNonBilled;
        }

        return {
          _id: p._id,
          patientName: p.patientName,
          // Returns array like: [{ physioId: "...", physioName: "...", sessionCount: 5 }]
          physioDetails: physioDetails,
          feeType: feeTypeName || "N/A",
          feePerSession:
            feeTypeName === "PerMonth"
              ? Number((baseFee / 26).toFixed(2))
              : baseFee,
          totalCompletedSessions: totalCompleted,
          totalIncome: Number(totalIncome.toFixed(2)),
          totalBilled: totalBilled,
          totalNonBilled: totalNonBilled,
          Billed: Number(Billed.toFixed(2)),
          NonBilled: Number(NonBilled.toFixed(2)),
        };
      }),
    );

    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

exports.getByPatientsName = async (req, res) => {
  try {
    const Patients = await Patient.findOne({ patientName: req.body.name });

    if (!Patients) {
      return res.status(400).json({ message: "Patients not found" });
    }

    res.status(200).json(Patients);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Update a Patients
exports.updatePatients = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const {
      _id,
      patientName,
      patientCode,
      isActive,
      consultationDate,
      historyOfFall,
      historyOfSurgery,
      historyOfSurgeryDetails,
      historyOfFallDetails,
      patientAge,
      patientGenderId,
      byStandar,
      Relation,
      patientNumber,
      patientAltNum,
      patientAddress,
      patientPinCode,
      patientCondition,
      physioId,
      reviewDate,
      MedicalHistoryAndRiskFactor,
      otherMedCon,
      currMed,
      typesOfLifeStyle,
      smokingOrAlcohol,
      dietaryHabits,
      Contraindications,
      painLevel,
      rangeOfMotion,
      muscleStrength,
      postureOrGaitAnalysis,
      functionalLimitations,
      static: staticValue,
      dynamic,
      coordination,
      ADLAbility,
      shortTermGoals,
      goalDescription,
      longTermGoals,
      RecomTherapy,
      Frequency,
      Duration,
      noOfDays,
      modalities,
      targetedArea,
      hodNotes,
      Physiotherapist,
      sessionStartDate,
      sessionTime,
      totalSessionDays,
      InitialShorttermGoal,
      goalDuration,
      visitOrder,
      KmsfromHub,
      KmsfLPatienttoHub,
      Feedback,
      Satisfaction,
      kmsFromPrevious,
      reviewFrequency,
      FeesTypeId,
      feeAmount,
      ReferenceId,
      isRecovered,
      recoveredAt,
      stopReason,
      recoveredType,
      isConsentReceived,
      removedDocuments,
    } = req.body;

    if (!_id) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Patient id is required" });
    }

    const finalIsRecovered = toBoolean(isRecovered, false);
    const finalIsActive = toBoolean(isActive, true);
    const finalHistoryOfFall = toBoolean(historyOfFall, false);
    const finalHistoryOfSurgery = toBoolean(historyOfSurgery, false);
    const finalSmokingOrAlcohol = toBoolean(smokingOrAlcohol, false);
    const finalModalities = toBoolean(modalities, false);
    const finalIsConsentReceived = toBoolean(isConsentReceived, false);
    const finalPatientGenderId = toNullableObjectId(patientGenderId);
    const finalReferenceId = toNullableObjectId(ReferenceId);
    const finalFeesTypeId = toNullableObjectId(FeesTypeId);
    const finalPhysioId = toNullableObjectId(physioId);

    if (finalIsRecovered === true) {
      if (!recoveredType) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          message: "Recovered type is required",
        });
      }

      if (recoveredType === "Other" && !stopReason) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          message: "Stop reason is required when recovered type is Other",
        });
      }
    }

    const existingPatient = await Patient.findById(_id)
      .populate("FeesTypeId")
      .session(session);

    if (!existingPatient) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Patient not found" });
    }

    const wasRecoveredBefore = !!existingPatient.isRecovered;

    let existingDocuments = Array.isArray(existingPatient.patientDocuments)
      ? [...existingPatient.patientDocuments]
      : [];

    if (removedDocuments) {
      let removedDocsArray = [];

      try {
        removedDocsArray =
          typeof removedDocuments === "string"
            ? JSON.parse(removedDocuments)
            : removedDocuments;

        if (!Array.isArray(removedDocsArray)) {
          removedDocsArray = [];
        }
      } catch (error) {
        removedDocsArray = [];
      }

      existingDocuments = existingDocuments.filter((doc) => {
        const shouldRemove = removedDocsArray.includes(doc.fileUrl);

        if (shouldRemove) {
          const fullPath = path.join(__dirname, "../../", doc.fileUrl);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        }

        return !shouldRemove;
      });
    }

    if (req.files && req.files.length > 0) {
      const newDocuments = req.files.map((file) => ({
        fileName: file.originalname,
        fileUrl: `/uploads/patients/${file.filename}`,
        fileType: file.mimetype,
      }));

      existingDocuments.push(...newDocuments);
    }

    const updatedPatient = await Patient.findByIdAndUpdate(
      _id,
      {
        $set: {
          patientName,
          patientCode,
          isActive: finalIsActive,
          consultationDate,
          historyOfFall: finalHistoryOfFall,
          historyOfSurgery: finalHistoryOfSurgery,
          historyOfSurgeryDetails,
          historyOfFallDetails,
          patientAge,

          byStandar,
          Relation,
          patientNumber,
          patientAltNum,
          patientAddress,
          patientPinCode,
          patientCondition,
          physioId: finalPhysioId,
          reviewDate,
          MedicalHistoryAndRiskFactor,
          otherMedCon,
          currMed,
          patientGenderId: finalPatientGenderId,
          typesOfLifeStyle,
          smokingOrAlcohol: finalSmokingOrAlcohol,
          dietaryHabits,
          Contraindications,
          painLevel,
          rangeOfMotion,
          muscleStrength,
          postureOrGaitAnalysis,
          functionalLimitations,
          static: staticValue,
          dynamic,
          coordination,
          ADLAbility,
          shortTermGoals,
          goalDescription,
          longTermGoals,
          RecomTherapy,
          Frequency,
          Duration,
          noOfDays,
          Modalities: finalModalities,
          targetedArea,
          hodNotes,
          Physiotherapist,
          sessionStartDate,
          sessionTime,
          totalSessionDays,
          InitialShorttermGoal,
          goalDuration,
          visitOrder,
          KmsfromHub,
          KmsfLPatienttoHub,
          Feedback,
          Satisfaction,
          kmsFromPrevious,
          reviewFrequency,
          FeesTypeId: finalFeesTypeId,
          feeAmount,
          ReferenceId: finalReferenceId,
          patientDocuments: existingDocuments,
          isRecovered: finalIsRecovered,
          recoveredAt: finalIsRecovered ? recoveredAt || new Date() : null,
          stopReason:
            finalIsRecovered && recoveredType === "Other" ? stopReason : null,
          recoveredType: finalIsRecovered ? recoveredType : null,
          isConsentReceived: finalIsConsentReceived,
        },
      },
      {
        new: true,
        runValidators: true,
        session,
      },
    ).populate("FeesTypeId");

    if (!updatedPatient) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Patient not able to update",
      });
    }

    let generatedBill = null;

    // keep this block commented if you want separate recovery api billing
    /*
    if (finalIsRecovered === true && wasRecoveredBefore === false) {
      const COMPLETED_STATUS_ID = new mongoose.Types.ObjectId(
        "691ec69eae0e10763c8f21e0"
      );

      const counter = await Counter.findOneAndUpdate(
        { _id: "invoiceNo" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, session }
      );

      const unbilledCompletedSessions = await Session.find({
        patientId: updatedPatient._id,
        sessionStatusId: COMPLETED_STATUS_ID,
        isBilled: false,
      })
        .sort({ sessionDate: 1, createdAt: 1 })
        .session(session);

      if (unbilledCompletedSessions.length > 0) {
        const sessionIds = unbilledCompletedSessions.map((s) => s._id);
        const totalSessionCount = unbilledCompletedSessions.length;
        const firstDate = unbilledCompletedSessions[0].sessionDate;
        const lastDate =
          unbilledCompletedSessions[unbilledCompletedSessions.length - 1]
            .sessionDate;

        const billPhysioId =
          unbilledCompletedSessions[0]?.physioId || updatedPatient.physioId;

        let ratePerSession = 0;
        let totalBill = 0;

        const feesTypeName = updatedPatient?.FeesTypeId?.feesTypeName || "";

        if (feesTypeName === "PerMonth") {
          const totalDays = Number(
            updatedPatient.totalSessionDays || updatedPatient.noOfDays || 0
          );

          if (!totalDays || totalDays <= 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
              message:
                "Total session days / no of days is required for PerMonth billing",
            });
          }

          ratePerSession = Number(updatedPatient.feeAmount || 0) / totalDays;
          totalBill = ratePerSession * totalSessionCount;
        } else {
          ratePerSession = Number(updatedPatient.feeAmount || 0);
          totalBill = ratePerSession * totalSessionCount;
        }

        const advPaidAgg = await Debit.aggregate([
          { $match: { patientId: updatedPatient._id } },
          { $group: { _id: null, total: { $sum: "$DebitAmount" } } },
        ]).session(session);

        const advPaid = advPaidAgg[0]?.total || 0;

        const usedAdvAgg = await Bill.aggregate([
          { $match: { patientId: updatedPatient._id } },
          { $group: { _id: null, total: { $sum: "$DeductedFromAdvance" } } },
        ]).session(session);

        const usedAdv = usedAdvAgg[0]?.total || 0;

        const deduct = Math.min(Math.max(advPaid - usedAdv, 0), totalBill);
        const netBilledAmount = totalBill - deduct;
        const invoiceNo = `HNI-${String(counter.seq).padStart(6, "0")}`;
        const billDate = new Date(lastDate);

        const createdBill = await Bill.create(
          [
            {
              patientId: updatedPatient._id,
              physioId: billPhysioId,
              invoiceNo,
              paymentStatus: netBilledAmount <= 0 ? "Paid" : "Pending",
              paymentType:
                netBilledAmount <= 0
                  ? "Full Payment"
                  : deduct > 0
                  ? "Partial Payment"
                  : "Pending",
              ReceivedAmount: Number(deduct.toFixed(2)),
              TotalBilledAmount: Number(totalBill.toFixed(2)),
              DeductedFromAdvance: Number(deduct.toFixed(2)),
              NetBilledAmount: Number(netBilledAmount.toFixed(2)),
              startDate: firstDate,
              ToDate: lastDate,
              ratePerSession: Number(ratePerSession.toFixed(2)),
              TotalSessionCount: totalSessionCount,
              month: billDate.toLocaleString("default", { month: "long" }),
              year: billDate.getFullYear(),
              isComplete: netBilledAmount <= 0,
            },
          ],
          { session }
        );

        generatedBill = createdBill[0];

        await Session.updateMany(
          { _id: { $in: sessionIds } },
          {
            $set: {
              isBilled: true,
              billId: generatedBill._id,
            },
          },
          { session }
        );
      }
    }
    */

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message:
        finalIsRecovered === true && wasRecoveredBefore === false
          ? "Patient updated successfully and marked as recovered"
          : "Patient updated successfully",
      data: updatedPatient,
      bill: generatedBill || null,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while updating patient",
    });
  }
};
exports.markPatientRecovered = async (req, res) => {
  const dbSession = await mongoose.startSession();

  try {
    dbSession.startTransaction();

    const { patientId, recoveredType, stopReason } = req.body;

    if (!patientId) throw new Error("Patient id is required");
    if (!recoveredType) throw new Error("Recovered type is required");
    if (recoveredType === "Other" && !stopReason) {
      throw new Error("Stop reason required for Other");
    }

    const patient = await Patient.findById(patientId)
      .populate("FeesTypeId")
      .session(dbSession);

    if (!patient) throw new Error("Patient not found");
    if (patient.isRecovered) throw new Error("Already recovered");

    const COMPLETED_STATUS_ID = new mongoose.Types.ObjectId(
      "691ec69eae0e10763c8f21e0",
    );

    // TAKE ONLY UNBILLED COMPLETED SESSIONS
    const sessions = await Session.find({
      patientId: patient._id,
      sessionStatusId: COMPLETED_STATUS_ID,
      isBilled: { $ne: true },
    })
      .sort({ sessionDate: 1 })
      .session(dbSession);

    let generatedBill = null;

    if (sessions.length > 0) {
      const sessionIds = sessions.map((s) => s._id);

      const totalSessionCount = sessions.length;
      const firstDate = sessions[0].sessionDate;
      const lastDate = sessions[sessions.length - 1].sessionDate;

      const feeAmount = Number(patient?.feeAmount || 0);

      const feeType = (patient?.FeesTypeId?.feesTypeName || "")
        .replace(/\s+/g, "")
        .toLowerCase();

      let totalBill = 0;
      let ratePerSession = 0;

      // BILLING LOGIC
      if (feeType === "permonth") {
        ratePerSession = feeAmount / 26;
        totalBill = ratePerSession * totalSessionCount;
      } else if (feeType === "persession") {
        ratePerSession = feeAmount;
        totalBill = feeAmount * totalSessionCount;
      } else {
        throw new Error("Invalid fee type");
      }

      // ADVANCE CALCULATION
      const advPaid =
        (
          await Debit.aggregate(
            [
              { $match: { patientId: patient._id } },
              {
                $group: {
                  _id: null,
                  total: { $sum: "$DebitAmount" },
                },
              },
            ],
            { session: dbSession },
          )
        )[0]?.total || 0;

      const usedAdv =
        (
          await Bill.aggregate(
            [
              { $match: { patientId: patient._id } },
              {
                $group: {
                  _id: null,
                  total: { $sum: "$DeductedFromAdvance" },
                },
              },
            ],
            { session: dbSession },
          )
        )[0]?.total || 0;

      const deduct = Math.min(Math.max(advPaid - usedAdv, 0), totalBill);
      const net = totalBill - deduct;

      const safeTotalBill = Number((totalBill || 0).toFixed(2));
      const safeDeduct = Number((deduct || 0).toFixed(2));
      const safeNet = Number((net || 0).toFixed(2));
      const safeRate = Number((ratePerSession || 0).toFixed(2));

      // INVOICE NUMBER
      const counter = await Counter.findOneAndUpdate(
        { _id: "invoiceNo" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, session: dbSession },
      );

      const invoiceNo = `HNI-${String(counter.seq).padStart(6, "0")}`;

      const billDate = new Date(lastDate);

      // CREATE BILL
      const bill = await Bill.create(
        [
          {
            patientId: patient._id,
            physioId: sessions[0]?.physioId || patient.physioId,
            invoiceNo,

            paymentStatus: safeNet <= 0 ? "Paid" : "Pending",

            paymentType:
              safeNet <= 0
                ? "Full Payment"
                : safeDeduct > 0
                  ? "Partial Payment"
                  : "Pending",

            ReceivedAmount: safeDeduct,

            TotalBilledAmount: safeTotalBill,
            DeductedFromAdvance: safeDeduct,
            NetBilledAmount: safeNet,

            startDate: firstDate,
            ToDate: lastDate,

            ratePerSession: safeRate,
            totalAmount: safeTotalBill,
            TotalSessionCount: totalSessionCount,

            month: billDate.toLocaleString("default", {
              month: "long",
            }),

            year: billDate.getFullYear(),

            isComplete: safeNet <= 0,

            feeType: feeType,
          },
        ],
        { session: dbSession },
      );

      generatedBill = bill[0];

      // MARK SESSIONS AS BILLED
      await Session.updateMany(
        { _id: { $in: sessionIds } },
        {
          $set: {
            isBilled: true,
            billId: generatedBill._id,
          },
        },
        { session: dbSession },
      );
    }

    // MARK PATIENT RECOVERED
    const updatedPatient = await Patient.findByIdAndUpdate(
      patientId,
      {
        $set: {
          isRecovered: true,
          isActive: false,
          recoveredAt: new Date(),
          recoveredType,
          stopReason: recoveredType === "Other" ? stopReason : null,
        },
      },
      { new: true, session: dbSession },
    );

    await dbSession.commitTransaction();
    dbSession.endSession();

    return res.status(200).json({
      success: true,
      message: "Patient recovered & bill generated successfully",
      bill: generatedBill,
      patient: updatedPatient,
    });
  } catch (error) {
    await dbSession.abortTransaction();
    dbSession.endSession();

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
exports.updatePatientFeedbacks = async (req, res) => {
  try {
    const { patientId, Feedback, Satisfaction } = req.body;

    if (!patientId) {
      return res.status(400).json({ message: "patientId is required" });
    }

    const patient = await Patient.findByIdAndUpdate(
      patientId,
      {
        $set: {
          Feedback,
          Satisfaction,
        },
      },
      { new: true },
    );

    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    res.status(200).json({
      message: "Feedback updated successfully",
      data: patient,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.updatePatientGoals = async (req, res) => {
  try {
    const {
      patientId,
      shortTermGoals,
      longTermGoals,
      physioshortTermGoals,
      physiolongTermGoals,
      goalDuration,
      feedback,
      satisfaction,
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: "Patient ID is required",
      });
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    // optional old goal log
    if (patient.shortTermGoals) {
      const prevGoalEntry = {
        goal: patient.shortTermGoals,
        feedback: patient.Feedback || "",
        satisfaction: patient.Satisfaction ?? null,
        status: "Reviewed & Completed",
        date: new Date().toISOString().split("T")[0],
      };

      patient.goalLog = patient.goalLog || [];
      patient.goalLog.push(prevGoalEntry);
    }

    // HOD / admin goals
    if (shortTermGoals !== undefined) {
      patient.shortTermGoals = shortTermGoals;
    }

    if (longTermGoals !== undefined) {
      patient.longTermGoals = longTermGoals;
    }

    // physio goals
    if (physioshortTermGoals !== undefined) {
      patient.physioshortTermGoals = physioshortTermGoals;
    }

    if (physiolongTermGoals !== undefined) {
      patient.physiolongTermGoals = physiolongTermGoals;
    }

    if (goalDuration !== undefined) {
      patient.goalDuration = Number(goalDuration);
    }

    if (feedback !== undefined) {
      patient.Feedback = feedback;
    }

    if (satisfaction !== undefined) {
      patient.Satisfaction = satisfaction;
    }

    patient.updatedAt = new Date();

    await patient.save();

    return res.status(200).json({
      success: true,
      message: "Patient goals updated successfully",
      data: patient,
    });
  } catch (error) {
    console.error("Update Patient Goals Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Delete a Patient
exports.deletePatients = async (req, res) => {
  try {
    const { _id } = req.body;

    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const Patients = await Patient.findByIdAndDelete(_id);

    if (!Patients) {
      return res.status(400).json({ message: "Patients not found" });
    }

    res.status(200).json({ message: "Patients deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.sessionAssignPhysio = async (req, res) => {
  try {
    const { newPhysioName, sessionCode, newPhysioId } = req.body;

    const updated = await Session.updateOne(
      {
        sessionCode,
      },
      {
        $set: {
          physioId: newPhysioId,
          physioName: newPhysioName,
        },
      },
    );

    if (!updated.matchedCount) {
      return res.status(404).json({ message: "Session not found for today." });
    }

    res.json({ message: "Physio assigned successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
exports.AssignPhysio = async (req, res) => {
  try {
    const {
      _id,
      sessionStartDate,
      sessionTime,
      physioId,
      totalSessionDays,
      InitialShorttermGoal,
      goalDuration,
      goalDescription,
      reviewFrequency,
      visitOrder,
      KmsfromHub,
      KmsfLPatienttoHub,
      kmsFromPrevious,
    } = req.body;

    const numericVisitOrder = Number(visitOrder);

    console.log("Incoming Data:", req.body);

    // 1️⃣ get current patient
    const currentPatient = await Patient.findById(_id);

    if (!currentPatient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found in DB",
      });
    }

    // 2️⃣ get all patients for this physio
    const patients = await Patient.find({
      physioId: physioId,
      isRecovered: false,
    }).sort({ visitOrder: 1 });

    // 3️⃣ check if patient already in list
    let currentIndex = patients.findIndex((p) => p._id.toString() === _id);

    if (currentIndex !== -1) {
      // remove from current position
      patients.splice(currentIndex, 1);
    } else {
      // add patient if new physio assignment
      patients.push(currentPatient);
    }

    // 4️⃣ insert into new visitOrder position
    patients.splice(numericVisitOrder - 1, 0, currentPatient);

    // remove duplicates
    const uniquePatients = [];
    const ids = new Set();

    for (const p of patients) {
      if (!ids.has(p._id.toString())) {
        uniquePatients.push(p);
        ids.add(p._id.toString());
      }
    }

    // 5️⃣ update visitOrder
    for (let i = 0; i < uniquePatients.length; i++) {
      console.log(
        `Updating ${uniquePatients[i].patientName} → visitOrder ${i + 1}`,
      );

      await Patient.findByIdAndUpdate(uniquePatients[i]._id, {
        visitOrder: i + 1,
        physioId: physioId,
      });
    }

    // 6️⃣ update patient extra fields
    const updatedPatient = await Patient.findByIdAndUpdate(
      _id,
      {
        sessionStartDate,
        sessionTime,
        physioId,
        totalSessionDays,
        InitialShorttermGoal,
        goalDuration,
        goalDescription,
        reviewFrequency,
        KmsfromHub,
        KmsfLPatienttoHub,
        kmsFromPrevious,
      },
      { new: true },
    )
      .populate("physioId", "physioName")
      .populate("patientGenderId", "genderName")
      .populate("ReferenceId", "sourceName");

    console.log("Updated Patient:", {
      name: updatedPatient.patientName,
      visitOrder: updatedPatient.visitOrder,
    });

    return res.status(200).json({
      success: true,
      message: "Physio Assigned & Visit Order Updated",
      AssignPhysio: updatedPatient,
    });
  } catch (error) {
    console.error("AssignPhysio Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getPhysioPatientCounts = async (req, res) => {
  try {
    const physioStats = await Patient.aggregate([
      {
        $match: {
          isRecovered: false,
          physioId: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$physioId",
          activePatientCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "physios",
          localField: "_id",
          foreignField: "_id",
          as: "physioDetails",
        },
      },
      {
        $unwind: "$physioDetails",
      },
      {
        $project: {
          _id: 0,
          physioId: "$_id",
          physioName: "$physioDetails.physioName",
          physioCode: "$physioDetails.physioCode",
          activePatientCount: 1,
        },
      },
      {
        $sort: { activePatientCount: -1 },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: physioStats,
    });
  } catch (error) {
    console.error("Error fetching physio patient counts:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
exports.downloadPatient = async (req, res) => {
  try {
    const { rangeType, month, year, startDate, endDate, view, targetDate } =
      req.body;

    const patientFilter = {};

    // view filter
    if (view === "recovered") patientFilter.isRecovered = true;
    else if (view === "active") patientFilter.isRecovered = { $ne: true };
    // else: no view filter (all)

    //Build date range
    let from = null;
    let to = null;

    // A) month/year
    if (rangeType === "month" && month && year) {
      from = new Date(year, Number(month) - 1, 1, 0, 0, 0);
      to = new Date(year, Number(month), 0, 23, 59, 59);
    }

    // B) last year
    if (rangeType === "lastYear") {
      to = new Date();
      from = new Date();
      from.setFullYear(to.getFullYear() - 1);
      from.setHours(0, 0, 0, 0);
    }

    // C) custom start/end
    if (startDate && endDate) {
      from = new Date(startDate);
      to = new Date(endDate);
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
    }

    // D) single day targetDate
    if (!from && targetDate) {
      from = new Date(targetDate);
      from.setHours(0, 0, 0, 0);

      to = new Date(targetDate);
      to.setHours(23, 59, 59, 999);
    }

    // date filter (createdAt)
    if (from && to) {
      patientFilter.createdAt = { $gte: from, $lte: to };
    }

    const patients = await Patient.find(patientFilter)
      .populate("patientGenderId", "genderName")
      .populate("physioId", "physioName")
      .sort({ createdAt: -1 }); // newest first

    return res.status(200).json(patients);
  } catch (error) {
    console.error("Error in downloadPatient:", error);
    return res.status(500).json({ message: error.message });
  }
};
exports.downloadPatientsMonthlyReport = async (req, res) => {
  try {
    const { month, year, view = "all" } = req.body;

    if (!month || !year) {
      return res.status(400).json({
        message: "month and year are required",
      });
    }

    const monthNum = Number(month);
    const yearNum = Number(year);

    if (
      Number.isNaN(monthNum) ||
      Number.isNaN(yearNum) ||
      monthNum < 1 ||
      monthNum > 12
    ) {
      return res.status(400).json({
        message: "Invalid month or year",
      });
    }

    const startDate = new Date(yearNum, monthNum - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);

    const sessionCompletedId = "691ec69eae0e10763c8f21e0";
    const sessionCancelledId = "692585f037162b40bd30a1ef";

    // 1) get sessions only for selected month
    const sessions = await Session.find({
      sessionDate: {
        $gte: startDate,
        $lte: endDate,
      },
    })
      .populate("physioId", "physioName")
      .populate("sessionStatusId", "sessionStatusName sessionStatusColor")
      .sort({ sessionDate: 1 });

    // 2) collect patient ids from session dates
    const uniquePatientIds = [
      ...new Set(
        sessions.map((s) => s.patientId && String(s.patientId)).filter(Boolean),
      ),
    ];

    if (uniquePatientIds.length === 0) {
      return res.status(200).json({
        month: monthNum,
        year: yearNum,
        view,
        startDate,
        endDate,
        summary: {
          totalPatients: 0,
          activePatients: 0,
          recoveredPatients: 0,
          totalSessions: 0,
          totalCompletedSessions: 0,
          totalCancelledSessions: 0,
        },
        report: [],
      });
    }

    // 3) patient filter only from those session patient ids
    const patientFilter = {
      _id: { $in: uniquePatientIds },
    };

    if (view === "recovered") {
      patientFilter.isRecovered = true;
    } else if (view === "active") {
      patientFilter.isRecovered = { $ne: true };
    }

    const patients = await Patient.find(patientFilter)
      .populate("FeesTypeId", "feesTypeName")
      .populate("patientGenderId", "genderName")
      .populate("MedicalHistoryAndRiskFactor.RiskFactorID", "RiskFactorName")
      .populate("physioId", "physioName")
      .sort({ createdAt: -1 });

    // 4) map sessions by patient
    const sessionMap = {};
    sessions.forEach((session) => {
      const pid = String(session.patientId);
      if (!sessionMap[pid]) {
        sessionMap[pid] = [];
      }
      sessionMap[pid].push(session);
    });

    // 5) build report
    const report = patients.map((patient) => {
      const patientSessions = sessionMap[String(patient._id)] || [];

      const completedSessions = patientSessions.filter((s) => {
        const statusId = String(
          s?.sessionStatusId?._id || s?.sessionStatusId || "",
        );
        return statusId === sessionCompletedId;
      }).length;

      const cancelledSessions = patientSessions.filter((s) => {
        const statusId = String(
          s?.sessionStatusId?._id || s?.sessionStatusId || "",
        );
        return statusId === sessionCancelledId;
      }).length;

      const isRecovered = patient.isRecovered === true;

      return {
        patientId: patient._id,
        patientCode: patient.patientCode || "",
        patientName: patient.patientName || "",
        age: patient.patientAge || "",
        gender: patient.patientGenderId?.genderName || "",
        number: patient.patientNumber || "",
        address: patient.patientAddress || "",
        condition: patient.patientCondition || "",
        consultationDate: patient.consultationDate || null,
        reviewDate: patient.reviewDate || null,
        isRecovered,
        recovered: isRecovered ? "Recovered" : "Active",
        statusLabel: isRecovered ? "Recovered" : "Active",
        assignedPhysio: patient.physioId?.physioName || "",
        totalSessions: patientSessions.length,
        completedSessions,
        cancelledSessions,
        sessions: patientSessions.map((s) => ({
          sessionId: s._id,
          sessionDate: s.sessionDate || null,
          statusId: String(s?.sessionStatusId?._id || s?.sessionStatusId || ""),
          status:
            s?.sessionStatusId?.sessionStatusName ||
            s?.sessionStatus ||
            s?.status ||
            "",
          remarks:
            s?.sessionFeedbackPros ||
            s?.sessionFeedbackCons ||
            s?.sessionCancelReason ||
            s?.remarks ||
            "",
          physioName: s?.physioId?.physioName || "",
        })),
      };
    });

    const summary = {
      totalPatients: report.length,
      activePatients: report.filter((p) => !p.isRecovered).length,
      recoveredPatients: report.filter((p) => p.isRecovered).length,
      totalSessions: report.reduce((sum, p) => sum + (p.totalSessions || 0), 0),
      totalCompletedSessions: report.reduce(
        (sum, p) => sum + (p.completedSessions || 0),
        0,
      ),
      totalCancelledSessions: report.reduce(
        (sum, p) => sum + (p.cancelledSessions || 0),
        0,
      ),
    };

    return res.status(200).json({
      month: monthNum,
      year: yearNum,
      view,
      startDate,
      endDate,
      summary,
      report,
    });
  } catch (error) {
    console.error("downloadPatientsMonthlyReport error:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};
exports.revertSingleSessionToScheduled = async (req, res) => {
  const dbSession = await mongoose.startSession();

  try {
    dbSession.startTransaction();

    const { sessionId, scheduledStatusId } = req.body;

    if (!sessionId) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return res.status(400).json({
        success: false,
        message: "sessionId is required",
      });
    }

    if (!scheduledStatusId) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return res.status(400).json({
        success: false,
        message: "scheduledStatusId is required",
      });
    }

    const sessionData = await Session.findById(sessionId).session(dbSession);

    if (!sessionData) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    const updatedSession = await Session.findByIdAndUpdate(
      sessionId,
      {
        $set: {
          sessionStatusId: scheduledStatusId,
          isBilled: false,
          billId: null,
          feedback: "",
          sessionFromTime: null,
          sessionToTime: null,
          completedAt: null,
        },
      },
      {
        new: true,
        session: dbSession,
      },
    );

    await dbSession.commitTransaction();
    dbSession.endSession();

    return res.status(200).json({
      success: true,
      message: "Session reverted to scheduled successfully",
      data: updatedSession,
    });
  } catch (error) {
    await dbSession.abortTransaction();
    dbSession.endSession();

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to revert session",
    });
  }
};
