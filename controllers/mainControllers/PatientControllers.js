const mongoose = require("mongoose");
const Patient = require("../../model/masterModels/Patient");
const Session = require("../../model/masterModels/Session");
const Counter = require("../../model/masterModels/Counter");

// Create a new Patient
exports.createPatients = async (req, res) => {
  try {
    const {
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
    } = req.body;
    // Check for duplicates (if needed)
    // const existingPatient = await Patient.findOne({ patientCode: patientCode });
    // if (existingPatient) {
    //   return res
    //     .status(400)
    //     .json({ message: "Patient with this code  already exists" });
    // }

    // Get the last HNP patient to continue numbering
    const existingPatient = await Patient.findOne({
      patientNumber: patientNumber,
    });

    if (existingPatient) {
      return res.status(200).json({
        success: false,
        message: "EXISTING_NUMBER",
      });
    }

    const lastHnpPatient = await Patient.find({
      patientCode: { $regex: /^HNP/ },
    })
      .sort({ createdAt: -1 })
      .limit(1);

    let nextId = 1;
    if (lastHnpPatient.length > 0) {
      nextId =
        parseInt(lastHnpPatient[0].patientCode.replace("HNP", ""), 10) + 1;
    }

    // Assign the new patientCode
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
    if (ReferenceId) {
      createData.ReferenceId = ReferenceId;
    }
    if (FeesTypeId) {
      createData.FeesTypeId = FeesTypeId;
    }
    if (physioId) {
      createData.physioId = physioId;
    }
    // Create and save the Patient
    const patients = new Patient(createData);
    await patients.save();

    res.status(200).json({
      message: "Patient created successfully",
      data: patients._id,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
    const { targetDate } = req.body; // Pass date like "2026-02-02"

    // 1. One-time fix for Patient Codes (Existing logic)
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

    // 2. NEW LOGIC: Filter by Session Date
    if (targetDate) {
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Find all sessions for that day
      const sessions = await Session.find({
        sessionDate: { $gte: startOfDay, $lte: endOfDay },
      }).select("patientId");

      // Extract unique Patient IDs from those sessions
      const patientIds = [
        ...new Set(sessions.map((s) => s.patientId.toString())),
      ];

      // Update filter to only find these patients
      patientFilter._id = { $in: patientIds };
    }

    // 3. Fetch Patients based on filter
    const patients = await Patient.find(patientFilter)
      .populate("FeesTypeId", "feesTypeName")
      .populate("patientGenderId", "genderName")
      .populate("MedicalHistoryAndRiskFactor.RiskFactorID", "RiskFactorName")
      .populate("physioId", "physioName");

    if (!patients || patients.length === 0) {
      return res.status(200).json([]); // Return empty array if no sessions on that date
    }

    const response = patients.map((p) => ({
      ...p._doc,
      FeesTypeName: p.FeesTypeId?.feesTypeName || "N/A",
    }));

    res.status(200).json(response);
  } catch (error) {
    console.error("Error in getAllPatients:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getAllPatientsIncome = async (req, res) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) {
      return res.status(400).json({ message: "Month and Year are required." });
    }

    const patients = await Patient.find()
      .populate("FeesTypeId", "feesTypeName") // Correct field
      .populate("patientGenderId", "genderName")
      .populate("MedicalHistoryAndRiskFactor.RiskFactorID", "RiskFactorName")
      .populate("physioId", "physioName");

    const result = await Promise.all(
      patients.map(async (p) => {
        // Fetch sessions for the selected month
        const sessions = await Session.find({
          patientId: p._id,
          sessionDate: {
            $gte: new Date(year, month - 1, 1),
            $lt: new Date(year, month, 1),
          },
        });

        // Filter completed sessions
        const completedSessions = sessions.filter(
          (s) =>
            s.sessionStatusId?.sessionStatusName &&
            s.sessionStatusId.sessionStatusName.toLowerCase() === "completed",
        );

        const totalCompleted = completedSessions.length;

        // Calculate total income
        let totalIncome = 0;
        const feeTypeName = p.FeesTypeId?.feesTypeName;

        if (feeTypeName === "PerSession") {
          totalIncome = (p.feeAmount || 0) * totalCompleted;
        } else if (feeTypeName === "Monthly") {
          totalIncome = p.feeAmount || 0;
        }

        return {
          _id: p._id,
          patientName: p.patientName,
          feeType: feeTypeName || "N/A",
          feePerSession: p.feeAmount || 0,
          totalCompletedSessions: totalCompleted,
          totalIncome,
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
    // Validation for recovered logic
    if (isRecovered === true) {
      if (!recoveredType) {
        return res.status(400).json({
          message: "Recovered type is required",
        });
      }

      if (recoveredType === "Other" && !stopReason) {
        return res.status(400).json({
          message: "Stop reason is required when recovered type is Other",
        });
      }
    }

    const Patients = await Patient.findByIdAndUpdate(
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
      { new: true, runValidators: true },
    );

    if (!Patients) {
      return res.status(400).json({ message: "Patients Cant able to update" });
    }

    res
      .status(200)
      .json({ message: "Patients updated successfully", data: Patients });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updatePatientGoals = async (req, res) => {
  try {
    const { patientId, shortTermGoals, longTermGoals } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: "Patient ID is required",
      });
    }

    const updatedPatient = await Patient.findByIdAndUpdate(
      patientId,
      {
        shortTermGoals,
        longTermGoals,
        updatedAt: new Date(),
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updatedPatient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Patient goals updated successfully",
      data: updatedPatient,
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
