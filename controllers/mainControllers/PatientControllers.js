const mongoose = require("mongoose");
const Patient = require("../../model/masterModels/Patient");
const Session = require("../../model/masterModels/Session");
const Counter = require("../../model/masterModels/Counter");
const SessionModel = require("../../model/masterModels/Session");
const Bill = require("../../model/masterModels/Bill");
const Debit = require("../../model/masterModels/DebitPayment");
const TreatmentCycle = require("../../model/masterModels/TreatmentCycle");

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
      feeAmount,
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
  dbSession.startTransaction();

  try {
    const { patientId, physioId } = req.body;

    const patient = await Patient.findById(patientId).session(dbSession);

    if (!patient) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return res.status(404).json({ message: "Patient not found" });
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

    patient.activeCycleId = newCycle[0]._id;
    patient.isRecovered = false;
    patient.recoveredAt = null;
    patient.stopReason = null;
    patient.recoveredType = null;

    await patient.save({ session: dbSession });

    await dbSession.commitTransaction();
    dbSession.endSession();

    return res.status(200).json({
      success: true,
      message: "Fresh cycle started successfully",
      cycle: newCycle[0],
    });
  } catch (error) {
    await dbSession.abortTransaction();
    dbSession.endSession();
    return res.status(500).json({ message: error.message });
  }
};
exports.continueOldCycle = async (req, res) => {
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    const { patientId } = req.body;

    const patient = await Patient.findById(patientId).session(dbSession);

    if (!patient) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return res.status(404).json({ message: "Patient not found" });
    }

    const lastCycle = await TreatmentCycle.findOne({
      patientId,
    })
      .sort({ cycleNumber: -1 })
      .session(dbSession);

    if (!lastCycle) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return res.status(404).json({ message: "No old cycle found" });
    }

    lastCycle.cycleStatus = "active";
    lastCycle.endDate = null;
    await lastCycle.save({ session: dbSession });

    patient.activeCycleId = lastCycle._id;
    patient.isRecovered = false;
    patient.recoveredAt = null;
    patient.stopReason = null;
    patient.recoveredType = null;

    await patient.save({ session: dbSession });

    await dbSession.commitTransaction();
    dbSession.endSession();

    return res.status(200).json({
      success: true,
      message: "Old cycle continued successfully",
      cycle: lastCycle,
    });
  } catch (error) {
    await dbSession.abortTransaction();
    dbSession.endSession();
    return res.status(500).json({ message: error.message });
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

    for (const p of patients) {
      let count = 0;

      if (p.activeCycleId) {
        count = await Session.countDocuments({
          patientId: p._id,
          cycleId: p.activeCycleId,
          sessionStatusId: COMPLETED_STATUS_ID,
        });
      } else {
        count = await Session.countDocuments({
          patientId: p._id,
          sessionStatusId: COMPLETED_STATUS_ID,
        });
      }

      sessionCountMap[p._id.toString()] = count;
    }

    const response = patients.map((p) => ({
      ...p._doc,
      FeesTypeName: p.FeesTypeId?.feesTypeName || "N/A",
      sessionCount: sessionCountMap[p._id.toString()] || 0,
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
  session.startTransaction();

  try {
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
      isRecovered,
      recoveredAt,
      stopReason,
      recoveredType,
      isConsentReceived,
    } = req.body;

    if (!_id) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Patient id is required" });
    }

    // Validation for recovered logic
    if (isRecovered === true) {
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
      return res.status(400).json({ message: "Patient not found" });
    }

    const wasRecoveredBefore = !!existingPatient.isRecovered;

    const updatedPatient = await Patient.findByIdAndUpdate(
      _id,
      {
        $set: {
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
          isRecovered,
          recoveredAt: isRecovered ? recoveredAt || new Date() : null,
          stopReason:
            isRecovered && recoveredType === "Other" ? stopReason : null,
          recoveredType: isRecovered ? recoveredType : null,
          isConsentReceived,
        },
      },
      { new: true, runValidators: true, session },
    ).populate("FeesTypeId");

    if (!updatedPatient) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Patients Cant able to update" });
    }

    let generatedBill = null;

    // ✅ Generate bill only when patient is newly marked as recovered
    if (isRecovered === true && wasRecoveredBefore === false) {
      const COMPLETED_STATUS_ID = new mongoose.Types.ObjectId(
        "691ec69eae0e10763c8f21e0",
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
            updatedPatient.totalSessionDays || updatedPatient.noOfDays || 0,
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

        const billDate = new Date(lastDate);

        generatedBill = await Bill.create(
          [
            {
              patientId: updatedPatient._id,
              physioId: billPhysioId,
              paymentStatus: netBilledAmount <= 0 ? "Paid" : "Pending",
              paymentType:
                netBilledAmount <= 0
                  ? "Full Payment"
                  : deduct > 0
                    ? "Partial Payment"
                    : undefined,
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
          { session },
        );

        generatedBill = generatedBill[0];

        await Session.updateMany(
          { _id: { $in: sessionIds } },
          {
            $set: {
              isBilled: true,
              billId: generatedBill._id,
            },
          },
          { session },
        );
      }
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message:
        isRecovered === true && wasRecoveredBefore === false
          ? generatedBill
            ? "Patients updated successfully and bill generated"
            : "Patients updated successfully. No unbilled completed sessions found for billing"
          : "Patients updated successfully",
      data: updatedPatient,
      bill: generatedBill || null,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ message: error.message });
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
    const { patientId, shortTermGoals, goalDuration, feedback, satisfaction } =
      req.body;

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

    if (shortTermGoals !== undefined) {
      patient.shortTermGoals = shortTermGoals;
    }

    if (goalDuration !== undefined) {
      patient.goalDuration = Number(goalDuration);
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

    const AssignPhysio = await Patient.findByIdAndUpdate(
      _id,
      {
        $set: {
          sessionStartDate,
          sessionTime,
          totalSessionDays,
          InitialShorttermGoal,
          goalDuration,
          physioId,
          goalDescription,
          reviewFrequency,
          visitOrder,
          KmsfromHub,
          KmsfLPatienttoHub,
          kmsFromPrevious,
        },
      },
      { new: true, runValidators: true },
    );

    if (!AssignPhysio) {
      return res
        .status(400)
        .json({ message: "AssignPhysio Cant able to update" });
    }

    // const counter = await Counter.findByIdAndUpdate(
    //   { _id: "sessionCode" },
    //   { $inc: { seq: totalSessionDays } },
    //   { new: true, upsert: true },
    // );

    // let nextSequenceNumber = counter.seq - totalSessionDays + 1;

    // let currentDate = new Date(sessionStartDate);
    // currentDate.setHours(12, 0, 0, 0);

    // const sessionsToCreate = [];
    // let sessionsGenerated = 0;

    // const daysOfWeek = [
    //   "Sunday",
    //   "Monday",
    //   "Tuesday",
    //   "Wednesday",
    //   "Thursday",
    //   "Friday",
    //   "Saturday",
    // ];

    // while (sessionsGenerated < totalSessionDays) {
    //   const currentDayIndex = currentDate.getDay();

    //   // Skip Sunday
    //   if (currentDayIndex === 0) {
    //     currentDate.setDate(currentDate.getDate() + 1);
    //     continue;
    //   }
    //   const formattedCode = `SESS-${String(nextSequenceNumber).padStart(
    //     6,
    //     "0",
    //   )}`;

    //   sessionsToCreate.push({
    //     patientId: _id,
    //     physioId: physioId,
    //     sessionDate: new Date(currentDate),
    //     sessionTime: sessionTime,
    //     sessionStatusId: new mongoose.Types.ObjectId(
    //       "691ecb36b87c5c57dead47a7",
    //     ),
    //     sessionDay: daysOfWeek[currentDayIndex],
    //     sessionCode: formattedCode,
    //   });

    //   // Increment our local counters
    //   sessionsGenerated++;
    //   nextSequenceNumber++; // Move to the next number for the loop

    //   currentDate.setDate(currentDate.getDate() + 1);
    // }

    // if (sessionsToCreate.length > 0) {
    //   await Session.insertMany(sessionsToCreate);
    // }

    res.status(200).json({
      message: "Physio Assigned",
      AssignPhysio: AssignPhysio,
    });
  } catch (error) {
    console.error("Error assigning physio:", error);
    res.status(500).json({ message: error.message });
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
