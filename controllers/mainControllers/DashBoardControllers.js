const mongoose = require("mongoose");
const Leads = require("../../model/masterModels/Leads");
const Patients = require("../../model/masterModels/Patient");
const Physio = require("../../model/masterModels/Physio");
const Session = require("../../model/masterModels/Session");
const Consultation = require("../../model/masterModels/Consultation");
const Review = require("../../model/masterModels/Review");
const PatientModel = require("../../model/masterModels/Patient");
const SessionStatus = require("../../model/masterModels/SessionStatus");
const Bill = require("../../model/masterModels/Bill");
const ReviewStatus = require("../../model/masterModels/ReviewStatus");
const Expense = require("../../model/masterModels/Expense");
const ConsultationModel = require("../../model/masterModels/Consultation");
const Lead = require("../../model/masterModels/Leads");
exports.getIncomeByDate = async (req, res) => {
  try {
    let { fromDate, toDate } = req.body;

    if (fromDate && !toDate) toDate = fromDate;

    const now = new Date();

    // ✅ DATE RANGE (IST SAFE)
    const startDate = fromDate
      ? new Date(`${fromDate}T00:00:00`)
      : new Date(now.getFullYear(), now.getMonth(), 1);

    const endDate = fromDate
      ? new Date(`${toDate}T23:59:59`)
      : new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // ✅ Get Completed Status ID
    const completedStatus = await SessionStatus.findOne({
      sessionStatusName: "Completed", // case-insensitive
    }).select("_id");

    if (!completedStatus) {
      return res.status(400).json({
        message: "Completed status not found in DB",
      });
    }

    // ✅ Load patients
    const patients = await Patients.find().populate(
      "FeesTypeId",
      "feesTypeName",
    );

    // ✅ Process each patient
    const result = await Promise.all(
      patients.map(async (p) => {
        // ✅ IMPORTANT FIX: use correct field → sessionDate
        const completedCount = await Session.countDocuments({
          patientId: p._id,
          sessionStatusId: completedStatus._id,
          sessionDate: { $gte: startDate, $lt: endDate }, // ✅ FIXED
        });
        const feeTypeName = p.FeesTypeId?.feesTypeName || "N/A";
        const baseFee = Number(p.feeAmount || 0);

        // ✅ Fee calculation
        let feePerSession = 0;
        if (feeTypeName === "PerSession") {
          feePerSession = baseFee;
        } else if (feeTypeName === "PerMonth") {
          feePerSession = baseFee / 26;
        }

        const totalIncome = Math.round(completedCount * feePerSession);

        return {
          _id: p._id,
          patientName: p.patientName,
          feeType: feeTypeName,
          feePerSession: Math.round(feePerSession),
          totalCompletedSessions: completedCount,
          totalIncome,
        };
      }),
    );

    // ✅ Totals
    const totalCompletedAmount = result.reduce(
      (sum, p) => sum + p.totalIncome,
      0,
    );

    const totalCompletedSessions = result.reduce(
      (sum, p) => sum + p.totalCompletedSessions,
      0,
    );

    const avgPricePerSession =
      totalCompletedSessions > 0
        ? Math.round(totalCompletedAmount / totalCompletedSessions)
        : 0;

    return res.status(200).json({
      totalCompletedAmount,
      totalCompletedSessions,
      avgPricePerSession,
      patients: result,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message });
  }
};
exports.getTodayIncome = async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const completedStatus = await SessionStatus.findOne({
      sessionStatusName: "Completed",
    }).select("_id");

    const MONTHLY_ID = "691af5c343be7d5e2861981f";

    const data = await Session.aggregate([
      {
        $match: {
          sessionDate: { $gte: start, $lte: end },
          sessionStatusId: completedStatus._id,
        },
      },
      {
        $lookup: {
          from: "patients",
          localField: "patientId",
          foreignField: "_id",
          as: "patient",
        },
      },
      { $unwind: "$patient" },
      {
        $group: {
          _id: null,
          totalCompletedCount: { $sum: 1 },
          totalCompletedAmount: {
            $sum: {
              $cond: [
                { $eq: [{ $toString: "$patient.FeesTypeId" }, MONTHLY_ID] },
                { $divide: ["$patient.feeAmount", 26] }, // monthly => per session
                "$patient.feeAmount", // per session
              ],
            },
          },
        },
      },
    ]);

    return res.json({
      totalCompletedAmount: Number(
        data?.[0]?.totalCompletedAmount || 0,
      ).toFixed(2),
      totalCompletedCount: data?.[0]?.totalCompletedCount || 0,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.getAllDashBoard = async (req, res) => {
  try {
    let { fromDate, toDate } = req.body;
    let dateQuery = {};
    const startDay = new Date();
    startDay.setHours(0, 0, 0, 0);

    const endDay = new Date();
    endDay.setHours(23, 59, 59, 999);
    let startDate;
    let endDate;
    if (fromDate && !toDate) toDate = fromDate;

    if (fromDate && toDate) {
      dateQuery = {
        createdAt: {
          $gte: new Date(fromDate + "T00:00:00.000Z"),
          $lte: new Date(toDate + "T23:59:59.999Z"),
        },
      };
    }
    const pendingStatus = await ReviewStatus.findOne({
      reviewStatusName: "Pending",
    });

    const completedStatusReview = await ReviewStatus.findOne({
      reviewStatusName: "Completed",
    });
    let lead = await Leads.countDocuments(dateQuery);
    let patient = await Patients.countDocuments({
      ...dateQuery,
      isRecovered: { $ne: true },
    });

    let pendingreviews = await Review.countDocuments({
      reviewStatusId: pendingStatus?._id,
      ...dateQuery, // IMPORTANT
    });

    let completedReview = await Review.countDocuments({
      reviewStatusId: completedStatusReview?._id,
      ...dateQuery,
    });

    let completedStatus = await SessionStatus.findOne({
      sessionStatusName: "Completed",
    });

    let completedSessionsCount = await Session.countDocuments({
      sessionStatusId: completedStatus?._id,
      sessionDate: {
        $gte: startDate,
        $lt: endDate,
      },
    });

    if (fromDate && toDate) {
      startDate = new Date(fromDate + "T00:00:00.000Z");
      endDate = new Date(toDate + "T23:59:59.999Z");
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    let patientRecover = await PatientModel.find({ isRecovered: true });
    let patientRecovered = await PatientModel.find({
      isRecovered: true,
      recoveredType: "Patient Recovered",
    });
    let patientRecoveredOthers = await PatientModel.find({
      isRecovered: true,
      recoveredType: "Other",
    });

    let physio = await Physio.find({
      roleId: new mongoose.Types.ObjectId("6926ca2ccddb76460d277717"),
      isActive: true,
    });

    let monthlySessions = await Session.countDocuments({
      sessionDate: { $gte: startDate, $lt: endDate },
    });

    let todaysession = await Session.find({
      sessionDate: { $gte: startDay, $lte: endDay },
    });
    let todayCompletedSession = await Session.countDocuments({
      sessionStatusId: completedStatus?._id,
      sessionDate: { $gte: startDay, $lte: endDay },
    });

    let filter = {
      lead,
      patient,
      physio: physio.length,
      monthlySessions,
      pendingreviews,
      patientRecovered: patientRecovered.length,
      patientRecoveredOthers: patientRecoveredOthers.length,
      completedReview,
      patientRecover: patientRecover.length,
      sessionCompleted: completedSessionsCount,
      todaysession: todaysession.length,
      todayCompletedSession,
    };

    return res.status(200).json(filter);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.monthlyfunnel = async (req, res) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) {
      return res.status(400).json({ message: "Month and Year are required" });
    }
    const startDate = new Date(year, month - 1, 1);
    const enddate = new Date(year, month, 1);

    const [newEnquiries, newConsultations, newPatients] = await Promise.all([
      Leads.find({ createdAt: { $gte: startDate, $lt: enddate } }),
      Consultation.find({ createdAt: { $gte: startDate, $lt: enddate } }),
      Patients.find({ createdAt: { $gte: startDate, $lt: enddate } }),
    ]);

    const conversionRate =
      newEnquiries.length > 0
        ? Math.round((newPatients.length / newEnquiries.length) * 100)
        : 0;

    return res.status(200).json({
      month,
      year,
      newEnquiries,
      newConsultations,
      newPatients,
      conversionRate,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
exports.getAllBillforDashboard = async (req, res) => {
  try {
    const bills = await Bill.find({
      paymentStatus: { $in: ["Pending", "Partially Paid"] },
    })
      .populate("patientId")
      .populate("physioId")
      .sort({ createdAt: -1 });

    return res.status(200).json(bills);
  } catch (error) {
    console.error("getAllBill error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch bills",
    });
  }
};

exports.getReportsSummary = async (req, res) => {
  try {
    const month = Number(req.body.month);
    const year = Number(req.body.year);
    const physioId = req.body.physioId;
    const referenceId = req.body.referenceId;

    if (!month || !year) {
      return res.status(400).json({ message: "Month and Year are required" });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const completedSessionStatus = await SessionStatus.findOne({
      sessionStatusName: "Completed",
    });

    const cancelledSessionStatus = await SessionStatus.findOne({
      sessionStatusName: "Canceled",
    });

    const completedReviewStatus = await ReviewStatus.findOne({
      reviewStatusName: "Completed",
    });

    const pendingReviewStatus = await ReviewStatus.findOne({
      reviewStatusName: "Pending",
    });

    if (!completedSessionStatus) {
      return res
        .status(400)
        .json({ message: "Completed session status not found" });
    }

    const refId =
      referenceId && referenceId !== "all"
        ? new mongoose.Types.ObjectId(referenceId)
        : null;

    const physId =
      physioId && physioId !== "all"
        ? new mongoose.Types.ObjectId(physioId)
        : null;

    // =========================
    // BASE SESSION FILTER
    // =========================
    let sessionFilter = {
      sessionDate: { $gte: startDate, $lt: endDate },
      ...(physId && { physioId: physId }),
    };

    // =========================
    // ADD REFERENCE FILTER (IMPORTANT FIX)
    // =========================
    if (refId) {
      const refPatients = await Patients.find(
        { ReferenceId: refId },
        { _id: 1 },
      );

      const refPatientIds = refPatients.map((p) => p._id);

      sessionFilter.patientId = { $in: refPatientIds };
    }

    // =========================
    // SESSION DATA
    // =========================
    const sessions = await Session.find(sessionFilter);

    const patientIds = await Session.distinct("patientId", sessionFilter);
    const physioIds = await Session.distinct("physioId", sessionFilter);

    // =========================
    // PATIENT STATS
    // =========================
    const totalPhysio = await Physio.countDocuments({
      _id: { $in: physioIds },
      isActive: true,
    });

    const totalActivePatients = await Patients.countDocuments({
      _id: { $in: patientIds },
      isRecovered: false,
    });

    const totalRecoveredPatients = await Patients.countDocuments({
      _id: { $in: patientIds },
      isRecovered: true,
    });

    const patientRecoveredCount = await Patients.countDocuments({
      _id: { $in: patientIds },
      isRecovered: true,
      recoveredType: "Patient Recovered",
    });

    const otherReasonRecoveredCount = await Patients.countDocuments({
      _id: { $in: patientIds },
      isRecovered: true,
      recoveredType: "Other",
    });

    // =========================
    // SESSION STATS
    // =========================
    const totalSessions = sessions.length;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todaySession = await Session.countDocuments({
      sessionDate: { $gte: todayStart, $lte: todayEnd },
      ...(physId && { physioId: physId }),
    });

    const completedSessions = sessions.filter(
      (s) => String(s.sessionStatusId) === String(completedSessionStatus._id),
    ).length;

    const cancelledSessions = sessions.filter(
      (s) => String(s.sessionStatusId) === String(cancelledSessionStatus?._id),
    ).length;

    const conversionRate =
      totalSessions > 0
        ? ((completedSessions / totalSessions) * 100).toFixed(2)
        : 0;

    // =========================
    // CONSULTATIONS (FIXED LOGIC)
    // =========================
    const consultationsFromLeads = await ConsultationModel.countDocuments({
      consultationDate: { $gte: startDate, $lt: endDate },
      ...(refId && { ReferenceId: refId }),
    });

    const newEnquiries = await Patients.countDocuments({
      createdAt: { $gte: startDate, $lt: endDate },
      ...(refId && { ReferenceId: refId }),
    });

    const convertedPatients = await Patients.countDocuments({
      createdAt: { $gte: startDate, $lt: endDate },
      isFromLead: true,
      ...(refId && { ReferenceId: refId }),
    });

    const totalLeads = await Lead.countDocuments({
      createdAt: { $gte: startDate, $lt: endDate },
      ...(refId && { ReferenceId: refId }),
    });

    const leadConversionRatess =
      totalLeads > 0 ? ((convertedPatients / totalLeads) * 100).toFixed(2) : 0;

    // =========================
    // REFERENCE WISE (FIXED ALIGNMENT)
    // =========================
    const referenceWise = await Session.aggregate([
      {
        $match: sessionFilter,
      },
      {
        $lookup: {
          from: "patients",
          localField: "patientId",
          foreignField: "_id",
          as: "patient",
        },
      },
      { $unwind: "$patient" },
      {
        $lookup: {
          from: "references",
          localField: "patient.ReferenceId",
          foreignField: "_id",
          as: "reference",
        },
      },
      { $unwind: { path: "$reference", preserveNullAndEmptyArrays: true } },

      {
        $group: {
          _id: "$patient.ReferenceId",
          sourceName: { $first: "$reference.sourceName" },
          totalSessions: { $sum: 1 },
          completedSessions: {
            $sum: {
              $cond: [
                { $eq: ["$sessionStatusId", completedSessionStatus._id] },
                1,
                0,
              ],
            },
          },
          cancelledSessions: {
            $sum: {
              $cond: [
                { $eq: ["$sessionStatusId", cancelledSessionStatus?._id] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // =========================
    // REVENUE (REFERENCE FIXED)
    // =========================
    const revenueData = await Session.aggregate([
      {
        $match: {
          ...sessionFilter,
          sessionStatusId: completedSessionStatus._id,
        },
      },
      {
        $lookup: {
          from: "patients",
          localField: "patientId",
          foreignField: "_id",
          as: "patient",
        },
      },
      { $unwind: "$patient" },

      {
        $lookup: {
          from: "feestypes",
          localField: "patient.FeesTypeId",
          foreignField: "_id",
          as: "feeType",
        },
      },
      { $unwind: { path: "$feeType", preserveNullAndEmptyArrays: true } },

      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: {
              $cond: [
                { $eq: ["$feeType.feesTypeName", "PerMonth"] },
                { $divide: ["$patient.feeAmount", 26] },
                "$patient.feeAmount",
              ],
            },
          },
        },
      },
    ]);

    const monthlyRevenue = revenueData[0]?.totalRevenue || 0;

    // =========================
    // EXPENSE (UNCHANGED)
    // =========================
    const monthlyExpenseData = await Expense.aggregate([
      {
        $match: {
          expenseDate: { $gte: startDate, $lt: endDate },
          isActive: true,
        },
      },
      {
        $lookup: {
          from: "expensetypes",
          localField: "ExpenseTypeID",
          foreignField: "_id",
          as: "type",
        },
      },
      { $unwind: "$type" },
      {
        $match: {
          "type.ExpenseTypeName": "Expenses",
        },
      },
      {
        $group: {
          _id: null,
          totalExpense: { $sum: "$expenseAmount" },
        },
      },
    ]);

    const totalExpense = monthlyExpenseData[0]?.totalExpense || 0;

    // =========================
    // REVIEWS
    // =========================
    const completedReviews = await Review.countDocuments({
      reviewStatusId: completedReviewStatus?._id,
      createdAt: { $gte: startDate, $lt: endDate },
    });

    const pendingReviews = await Review.countDocuments({
      reviewStatusId: pendingReviewStatus?._id,
      createdAt: { $gte: startDate, $lt: endDate },
    });

    const newPatients = await Patients.countDocuments({
      sessionStartDate: { $gte: startDate, $lt: endDate },
    });

    const leadConversionRate =
      newEnquiries > 0 ? ((newPatients / newEnquiries) * 100).toFixed(2) : 0;

    // =========================
    // FINAL RESPONSE
    // =========================
    return res.json({
      stats: {
        totalSessions,
        completedSessions,
        cancelledSessions,
        conversionRate: Number(conversionRate),

        totalActivePatients,
        totalRecoveredPatients,
        patientRecoveredCount,
        otherReasonRecoveredCount,

        referenceWise,
        physioWise: [],
        totalPhysio,

        todaySession,

        monthlyRevenue,
        totalExpense,

        completedReviews,
        pendingReviews,

        newEnquiries,
        newPatients,

        consultationsFromLeads,
        leadConversionRatess,
        leadConversionRate: Number(leadConversionRate),
      },
    });
  } catch (err) {
    console.error("getReportsSummary error:", err);
    res.status(500).json({ error: err.message });
  }
};
