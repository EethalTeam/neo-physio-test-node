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
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDir = "uploads/consultations";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(
      null,
      `consultation-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(
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
}).array("consultationDocuments", 10);

exports.consultationUploadMiddleware = (req, res, next) => {
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

const toBoolean = (value, defaultValue = false) => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  if (value === "" || value === undefined || value === null)
    return defaultValue;
  return Boolean(value);
};

const toNullableObjectId = (value) => {
  return value && value !== "" ? value : null;
};

const toNullableNumber = (value) => {
  return value === "" || value === undefined || value === null
    ? null
    : Number(value);
};
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

    const existingConsultate = await Consultation.findOne({
      patientCode: patientCode,
    });

    if (existingConsultate) {
      return res
        .status(400)
        .json({ message: "Consulation with this code already exists" });
    }

    let consultationDocuments = [];

    if (req.files && req.files.length > 0) {
      consultationDocuments = req.files.map((file) => ({
        fileName: file.originalname,
        fileUrl: `/uploads/consultations/${file.filename}`,
        fileType: file.mimetype,
      }));
    }
    const finalReferenceId = toNullableObjectId(ReferenceId);
    const finalFeesTypeId = toNullableObjectId(FeesTypeId);

    const finalHistoryOfFall = toBoolean(historyOfFall, false);
    const finalHistoryOfSurgery = toBoolean(historyOfSurgery, false);
    const finalSmokingOrAlcohol = toBoolean(smokingOrAlcohol, false);
    const finalModalities = toBoolean(Modalities, false);
    const finalIsActive = toBoolean(isActive, true);
    const consultate = new Consultation({
      patientName,
      patientCode,
      isActive: finalIsActive,
      consultationDate,
      historyOfFall: finalHistoryOfFall,
      historyOfSurgery: finalHistoryOfSurgery,
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

      smokingOrAlcohol: finalSmokingOrAlcohol,
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
      consultationDocuments,
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
      removedDocuments,
    } = req.body;

    const consultation = await Consultation.findById(_id);

    if (!consultation) {
      return res.status(404).json({ message: "Consultation not found" });
    }

    let existingDocuments = consultation.consultationDocuments || [];

    if (removedDocuments) {
      let removedDocsArray = [];

      try {
        removedDocsArray =
          typeof removedDocuments === "string"
            ? JSON.parse(removedDocuments)
            : removedDocuments;
      } catch (e) {
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
        fileUrl: `/uploads/consultations/${file.filename}`,
        fileType: file.mimetype,
      }));

      existingDocuments.push(...newDocuments);
    }
    const finalReferenceId = toNullableObjectId(ReferenceId);
    const finalFeesTypeId = toNullableObjectId(FeesTypeId);

    const finalHistoryOfFall = toBoolean(historyOfFall, false);
    const finalHistoryOfSurgery = toBoolean(historyOfSurgery, false);
    const finalSmokingOrAlcohol = toBoolean(smokingOrAlcohol, false);
    const finalModalities = toBoolean(Modalities, false);
    const finalIsActive = toBoolean(isActive, true);
    const consultate = await Consultation.findByIdAndUpdate(
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
          smokingOrAlcohol: finalSmokingOrAlcohol,
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
          consultationDocuments: existingDocuments,
        },
      },
      { new: true, runValidators: true },
    );

    if (!consultate) {
      return res
        .status(400)
        .json({ message: "consultate Cant able to update" });
    }

    res.status(200).json({
      message: "consultate updated successfully",
      data: consultate,
    });
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

  try {
    dbSession.startTransaction();

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

    // -----------------------------
    // Basic validation
    // -----------------------------
    if (!_id) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return res.status(400).json({
        success: false,
        message: "Consultation id is required",
      });
    }

    if (!physioId || !mongoose.Types.ObjectId.isValid(physioId)) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return res.status(400).json({
        success: false,
        message: "Valid physioId is required",
      });
    }

    if (
      visitOrder === undefined ||
      visitOrder === null ||
      visitOrder === "" ||
      Number(visitOrder) <= 0
    ) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return res.status(400).json({
        success: false,
        message: "Valid visitOrder is required",
      });
    }

    const numericVisitOrder = Number(visitOrder);

    // -----------------------------
    // Get consultation first
    // -----------------------------
    const consultation = await Consultation.findById(_id).session(dbSession);

    if (!consultation) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return res.status(404).json({
        success: false,
        message: "Consultation not found",
      });
    }

    // -----------------------------
    // Duplicate visitOrder check
    // same physio + active patient + not recovered
    // -----------------------------
    const duplicateVisitOrder = await Patient.findOne({
      physioId: new mongoose.Types.ObjectId(physioId),
      visitOrder: numericVisitOrder,
      isRecovered: false,
    }).session(dbSession);

    if (duplicateVisitOrder) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return res.status(400).json({
        success: false,
        message: `Visit order ${numericVisitOrder} already assigned to another patient for this physio`,
      });
    }

    // -----------------------------
    // Duplicate patient check
    // use consultation patient number
    // -----------------------------
    const consultationPatientNumber =
      consultationNumber || consultation.patientNumber;

    if (consultationPatientNumber) {
      const existingPatient = await Patient.findOne({
        patientNumber: consultationPatientNumber,
      }).session(dbSession);

      if (existingPatient) {
        await dbSession.abortTransaction();
        dbSession.endSession();
        return res.status(400).json({
          success: false,
          message: "Patient with this mobile number already exists",
        });
      }
    }

    // -----------------------------
    // Update consultation
    // -----------------------------
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
          visitOrder: numericVisitOrder,
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

    // -----------------------------
    // Safe fix for MedicalHistoryAndRiskFactor
    // -----------------------------
    let safeMedicalHistoryAndRiskFactor = [];

    if (Array.isArray(MedicalHistoryAndRiskFactor)) {
      safeMedicalHistoryAndRiskFactor = MedicalHistoryAndRiskFactor.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
        .map((item) => ({
          RiskFactorID:
            item.RiskFactorID && typeof item.RiskFactorID === "object"
              ? item.RiskFactorID._id || item.RiskFactorID
              : item.RiskFactorID || null,
          isExist:
            item.isExist === true ||
            item.isExist === "true" ||
            item.isExist === "Yes" ||
            item.isExist === "yes",
        }))
        .filter((item) => item.RiskFactorID);
    } else if (
      typeof MedicalHistoryAndRiskFactor === "string" &&
      MedicalHistoryAndRiskFactor.trim() !== ""
    ) {
      try {
        const parsedValue = JSON.parse(MedicalHistoryAndRiskFactor);

        if (Array.isArray(parsedValue)) {
          safeMedicalHistoryAndRiskFactor = parsedValue
            .filter(
              (item) =>
                item && typeof item === "object" && !Array.isArray(item),
            )
            .map((item) => ({
              RiskFactorID:
                item.RiskFactorID && typeof item.RiskFactorID === "object"
                  ? item.RiskFactorID._id || item.RiskFactorID
                  : item.RiskFactorID || null,
              isExist:
                item.isExist === true ||
                item.isExist === "true" ||
                item.isExist === "Yes" ||
                item.isExist === "yes",
            }))
            .filter((item) => item.RiskFactorID);
        }
      } catch (error) {
        safeMedicalHistoryAndRiskFactor = [];
      }
    }

    // -----------------------------
    // Generate patient code
    // -----------------------------
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

    // -----------------------------
    // Create active cycle id
    // -----------------------------
    const generatedCycleId = new mongoose.Types.ObjectId();

    // -----------------------------
    // Create patient
    // -----------------------------
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
      patientCondition: otherMedCon || patientCondition,
      physioId,
      reviewDate,
      MedicalHistoryAndRiskFactor: safeMedicalHistoryAndRiskFactor,
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
      visitOrder: numericVisitOrder,
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
