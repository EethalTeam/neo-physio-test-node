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
    const existingConsulate = await Consultation.findOne({
      patientCode: patientCode,
    });
    if (existingConsulate) {
      return res
        .status(400)
        .json({ message: "Consulation with this code  already exists" });
    }
    // Create and save the Patient
    const consulate = new Consultation({
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
    await consulate.save();

    res.status(200).json({
      message: "Patient created successfully",
      data: consulate._id,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Get allConsultation
exports.getAllConsultation = async (req, res) => {
  try {
    const consulate = await Consultation.find()
      .populate("patientGenderId", "genderName")
      .populate("MedicalHistoryAndRiskFactor.RiskFactorID", "RiskFactorName")
      .populate("physioId", "physioName");
    if (!consulate) {
      return res.status(400).json({ message: "consulate is not found" });
    }

    res.status(200).json(consulate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Get a single consulate by name
exports.getByConsultationName = async (req, res) => {
  try {
    const consulate = await Consultation.findOne({
      patientName: req.body.name,
    });

    if (!consulate) {
      return res.status(400).json({ message: "consulate not found" });
    }

    res.status(200).json(consulate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Update a consulate
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

    const consulate = await Consultation.findByIdAndUpdate(
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

    if (!consulate) {
      return res.status(400).json({ message: "consulate Cant able to update" });
    }

    res
      .status(200)
      .json({ message: "consulate updated successfully", data: consulate });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a consulate
exports.deleteConsultation = async (req, res) => {
  try {
    const { _id } = req.body;

    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const consulate = await Consultation.findByIdAndDelete(_id);

    if (!consulate) {
      return res.status(400).json({ message: "consulate not found" });
    }

    res.status(200).json({ message: "Consulate deleted successfully" });
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
    });
    if (existingPatient) {
      return res
        .status(400)
        .json({ message: "Patient with this mobile number already exists" });
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
      { new: true, runValidators: true },
    );

    if (!updatedConsultation) {
      return res
        .status(400)
        .json({ message: "Consultation not found or update failed" });
    }

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

    // const existingPatient = await Patient.findOne({
    //   patientNumber: patientNumber,
    // });
    // if (existingPatient) {
    //   return res
    //     .status(400)
    //     .json({ message: "Patient with this mobile number already exists" });
    // }
    // Get last HNP patient
    const lastHnpPatient = await Patient.findOne({
      patientCode: { $regex: /^HNP/ },
    }).sort({ createdAt: -1 });

    let nextHnpNumber = 1;

    if (lastHnpPatient?.patientCode) {
      nextHnpNumber =
        parseInt(lastHnpPatient.patientCode.replace("HNP", ""), 10) + 1;
    }

    const hnpPatientCode = `HNP${String(nextHnpNumber).padStart(6, "0")}`;
    console.log(hnpPatientCode, "hnpPatientCode");
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
    await newPatient.save();
    console.log(newPatient, "newPatient");

    // const counter = await Counter.findByIdAndUpdate(
    //   { _id: "sessionCode" },
    //   { $inc: { seq: totalSessionDays } },
    //   { new: true, upsert: true },
    // );

    // let nextSequenceNumber = counter.seq - totalSessionDays + 1;
    // let currentDate = new Date(sessionStartDate);
    // currentDate.setHours(12, 0, 0, 0);

    // const sessionsToCreate = [];
    // const reviewsToCreate = [];
    // const reviewTypeDefault = await ReviewType.findOne({
    //   reviewTypeName: "General",
    // });
    // if (!reviewTypeDefault) {
    //   return res.status(500).json({
    //     message:
    //       'Default ReviewType not found. Please create one named "Standard".',
    //   });
    // }

    // const reviewStatusDefault = await ReviewStatus.findOne({
    //   reviewStatusName: "Pending",
    // });
    // if (!reviewStatusDefault) {
    //   return res.status(500).json({
    //     message:
    //       'Default Reviewstatus not found. Please create one named "Standard".',
    //   });
    // }
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

    //   if (currentDayIndex === 0) {
    //     currentDate.setDate(currentDate.getDate() + 1);
    //     continue;
    //   }

    //   const formattedCode = `SESS-${String(nextSequenceNumber).padStart(6, "0")}`;
    //   const currentSessionDate = new Date(currentDate);

    //   sessionsToCreate.push({
    //     patientId: newPatient._id,
    //     physioId: physioId,
    //     sessionDate: currentSessionDate,
    //     sessionTime: sessionTime,
    //     sessionStatusId: new mongoose.Types.ObjectId(
    //       "691ecb36b87c5c57dead47a7",
    //     ),
    //     sessionDay: daysOfWeek[currentDayIndex],
    //     sessionCode: formattedCode,
    //   });

    //   sessionsGenerated++;
    //   nextSequenceNumber++;

    //   if (reviewFrequency > 0 && sessionsGenerated % reviewFrequency === 0) {
    //     reviewsToCreate.push({
    //       patientId: newPatient._id,
    //       physioId: physioId,
    //       reviewStatusId: new mongoose.Types.ObjectId(reviewStatusDefault._id),
    //       reviewDate: currentSessionDate,
    //       reviewTypeId: new mongoose.Types.ObjectId(reviewTypeDefault._id),
    //     });
    //   }

    //   currentDate.setDate(currentDate.getDate() + 1);
    // }

    // if (sessionsToCreate.length > 0) {
    //   await Session.insertMany(sessionsToCreate);
    // }

    // if (reviewsToCreate.length > 0) {
    //   await Review.insertMany(reviewsToCreate);
    // }

    res.status(200).json({
      success: true,
      // message: `Successfully generated ${sessionsToCreate.length} sessions and ${reviewsToCreate.length} reviews.`,
      message: "Physio Assigned successfully",
      data: {
        patient: newPatient,
        // sessionsCount: sessionsToCreate.length,
        // reviewsCount: reviewsToCreate.length,
      },
    });
  } catch (error) {
    console.error("Error in AssignPhysio:", error);
    res.status(500).json({ message: error.message });
  }
};
