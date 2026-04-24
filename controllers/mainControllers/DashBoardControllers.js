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
exports.getIncomeByDate = async (req, res) => {
  try {
    let { fromDate, toDate } = req.body;

    // if only fromDate, treat it as one day
    if (fromDate && !toDate) toDate = fromDate;

    // Date range: default = current month
    const startDate = fromDate
      ? new Date(`${fromDate}T00:00:00.000Z`)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const endDate = fromDate
      ? new Date(`${toDate}T23:59:59.999Z`)
      : new Date(
          new Date().getFullYear(),
          new Date().getMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        );
    // Load patients + fee type
    const patients = await Patients.find().populate(
      "FeesTypeId",
      "feesTypeName",
    );

    // Build result per patient
    const result = await Promise.all(
      patients.map(async (p) => {
        // Count only COMPLETED sessions in date range
        const sessions = await Session.find({
          patientId: p._id,
          sessionDate: { $gte: startDate, $lte: endDate },
        }).populate("sessionStatusId", "sessionStatusName");

        const completedCount = sessions.filter(
          (s) =>
            s.sessionStatusId?.sessionStatusName?.toLowerCase() === "completed",
        ).length;

        const feeTypeName = p.FeesTypeId?.feesTypeName || "N/A";
        const baseFee = Number(p.feeAmount || 0);

        // Fee per session logic
        let feePerSession = 0;
        if (feeTypeName === "PerSession") feePerSession = baseFee;
        else if (feeTypeName === "PerMonth") feePerSession = baseFee / 26;

        const totalIncome = Math.round(Number(completedCount * feePerSession));

        return {
          _id: p._id,
          patientName: p.patientName,
          feeType: feeTypeName,
          feePerSession: Math.round(Number(feePerSession)),
          totalCompletedSessions: Math.round(completedCount),
          totalIncome,
        };
      }),
    );

    // totals (IMPORTANT: reduce from result)
    const totalCompletedAmount = Number(
      result.reduce(
        (sum, p) => Math.round(sum + Number(p.totalIncome || 0)),
        0,
      ),
    );

    const totalCompletedSessions = result.reduce(
      (sum, p) => Math.round(sum + Number(p.totalCompletedSessions || 0)),
      0,
    );

    const avgPricePerSession =
      totalCompletedSessions > 0
        ? Math.round(Number(totalCompletedAmount / totalCompletedSessions))
        : 0;

    return res.status(200).json({
      totalCompletedAmount,
      totalCompletedSessions,
      avgPricePerSession,
      patients: result,
    });
  } catch (error) {
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
