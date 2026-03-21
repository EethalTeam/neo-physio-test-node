const mongoose = require("mongoose");
const Consultation = require("../../model/masterModels/Consultation");
const Session = require("../../model/masterModels/Session");
const Counter = require("../../model/masterModels/Counter");
const Patient = require("../../model/masterModels/Patient");
const Lead = require("../../model/masterModels/Leads");
const Leadstatus = require("../../model/masterModels/Leadstatus");
const Review = require("../../model/masterModels/Review");
const ReviewType = require("../../model/masterModels/ReviewType");
const ReviewStatus = require("../../model/masterModels/ReviewStatus");
const TreatmentCycle = require("../../model/masterModels/TreatmentCycle");

// Create a new Patient
exports.createConsultation = async (req, res) => {
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
      ADLAbility,
      shortTermGoals,
      goalDescription,
      longTermGoals,
      RecomTherapy,
      Frequency,
      Duration,
      noOfDays,
      Modalities,
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
    const existingConsultate = await Consultation.findOne({
      patientCode: patientCode,
    });
    if (existingConsultate) {
      return res
        .status(400)
        .json({ message: "Consulation with this code  already exists" });
    }
    // Create and save the Patient
    const consultate = new Consultation({
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
      ADLAbility,
      shortTermGoals,
      goalDescription,
      longTermGoals,
      RecomTherapy,
      Frequency,
      Duration,
      noOfDays,
      Modalities,
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
    });
    await consultate.save();

    res.status(200).json({
      message: "Patient created successfully",
      data: consultate._id,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Get allConsultation
exports.getAllConsultation = async (req, res) => {
  try {
    const consultate = await Consultation.find()
      .populate("patientGenderId", "genderName")
      .populate("MedicalHistoryAndRiskFactor.RiskFactorID", "RiskFactorName")
      .populate("physioId", "physioName");
    if (!consultate) {
      return res.status(400).json({ message: "consultate is not found" });
    }

    res.status(200).json(consultate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Get a single consultate by name
exports.getByConsultationName = async (req, res) => {
  try {
    const consultate = await Consultation.findOne({
      patientName: req.body.name,
    });

    if (!consultate) {
      return res.status(400).json({ message: "consultate not found" });
    }

    res.status(200).json(consultate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Update a consultate
exports.updateConsultation = async (req, res) => {
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
      ADLAbility,
      shortTermGoals,
      goalDescription,
      longTermGoals,
      RecomTherapy,
      Frequency,
      Duration,
      noOfDays,
      Modalities,
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

    const consultate = await Consultation.findByIdAndUpdate(
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
          ADLAbility,
          shortTermGoals,
          goalDescription,
          longTermGoals,
          RecomTherapy,
          Frequency,
          Duration,
          noOfDays,
          Modalities,
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
        },
      },
      { new: true, runValidators: true },
    );

    if (!consultate) {
      return res
        .status(400)
        .json({ message: "consultate Cant able to update" });
    }

    res
      .status(200)
      .json({ message: "consultate updated successfully", data: consultate });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a consultate
exports.deleteConsultation = async (req, res) => {
  try {
    const { _id } = req.body;

    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const consultate = await Consultation.findByIdAndDelete(_id);

    if (!consultate) {
      return res.status(400).json({ message: "consultate not found" });
    }

    res.status(200).json({ message: "Consultate deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.revertConsultation = async (req, res) => {
  try {
    const { id, status } = req.body;
    const leadstatus = await Leadstatus.findOne({ leadStatusName: status });
    const consult = await Consultation.findById(id);
    if (!consult) {
      return res.status(404).json({ message: "Consultation not found" });
    } else {
      const lead = await Lead.findOne({
        _id: new mongoose.Types.ObjectId(consult.leadId),
      });
      lead.LeadStatusId = new mongoose.Types.ObjectId(leadstatus._id);
      await lead.save();
      // const consultation = await Consultation.findById(id);
      const consultation = await Consultation.findByIdAndDelete(id);
      if (!consultation) {
        return res.status(404).json({ message: "Consultation not found" });
      }
      res.status(200).json({
        message: "Consultation reverted successfully",
        leadDetails: consultation,
      });
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

exports.AssignPhysio = async (req, res) => {
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

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
      consultationNumber,
      kmsFromPrevious,
    } = req.body;

    const existingPatient = await Patient.findOne({
      patientNumber: consultationNumber,
    }).session(dbSession);

    if (existingPatient) {
      await dbSession.abortTransaction();
      dbSession.endSession();

      return res.status(400).json({
        success: false,
        message: "Patient with this mobile number already exists",
      });
    }

    const updatedConsultation = await Consultation.findByIdAndUpdate(
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
      {
        new: true,
        runValidators: true,
        session: dbSession,
      },
    );

    if (!updatedConsultation) {
      await dbSession.abortTransaction();
      dbSession.endSession();

      return res.status(400).json({
        success: false,
        message: "Consultation not found or update failed",
      });
    }

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
      ADLAbility,
      shortTermGoals,
      longTermGoals,
      RecomTherapy,
      Frequency,
      Duration,
      noOfDays,
      Modalities,
      targetedArea,
      hodNotes,
      Physiotherapist,
      Feedback,
      Satisfaction,
      FeesTypeId,
      feeAmount,
      ReferenceId,
    } = updatedConsultation;

    // Generate patient code
    const lastHnpPatient = await Patient.findOne({
      patientCode: { $regex: /^HNP/ },
    })
      .sort({ createdAt: -1 })
      .session(dbSession);

    let nextHnpNumber = 1;

    if (lastHnpPatient?.patientCode) {
      nextHnpNumber =
        parseInt(lastHnpPatient.patientCode.replace("HNP", ""), 10) + 1;
    }

    const hnpPatientCode = `HNP${String(nextHnpNumber).padStart(6, "0")}`;

    // Generate only activeCycleId (no TreatmentCycle table insert)
    const generatedCycleId = new mongoose.Types.ObjectId();

    const newPatient = new Patient({
      patientName,
      patientCode: hnpPatientCode,
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
      ADLAbility,
      shortTermGoals,
      longTermGoals,
      RecomTherapy,
      Frequency,
      Duration,
      noOfDays,
      Modalities,
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
      goalDescription,
      FeesTypeId,
      feeAmount,
      ReferenceId,
      activeCycleId: generatedCycleId,
      isRecovered: false,
      recoveredAt: null,
    });

    await newPatient.save({ session: dbSession });

    await dbSession.commitTransaction();
    dbSession.endSession();

    const patientWithRefs = await Patient.findById(newPatient._id)
      .populate("patientGenderId", "genderName")
      .populate("physioId", "physioName")
      .populate("ReferenceId", "sourceName");

    return res.status(200).json({
      success: true,
      message: "Physio assigned successfully",
      data: {
        patient: patientWithRefs,
      },
    });
  } catch (error) {
    await dbSession.abortTransaction();
    dbSession.endSession();

    console.error("Error in AssignPhysio:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong",
    });
  }
};
