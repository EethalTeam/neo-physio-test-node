const mongoose = require("mongoose");
const Expense = require("../../model/masterModels/Expense");
const Session = require("../../model/masterModels/Session");
const Patient = require("../../model/masterModels/Patient");
// Create Expense
exports.createExpense = async (req, res) => {
  try {
    const {
      ExpenseTypeID,
      ExpenseCategoryId,
      expenseDate,
      expenseAmount,
      PhysioId,
      physioDescription,
      officeExpDes,
      ReferenceId,
      PatientId,
      referenceDes,
      MachineiId,
      machineDes,
      otherDescription,
    } = req.body;

    const expense = new Expense({
      ExpenseTypeID,
      ExpenseCategoryId,
      expenseDate,
      expenseAmount,
      PhysioId: PhysioId || null,
      physioDescription: physioDescription || "",
      officeExpDes: officeExpDes || "",
      ReferenceId: ReferenceId || null,
      PatientId: PatientId || null,
      referenceDes: referenceDes || "",
      MachineiId: MachineiId || null,
      machineDes: machineDes || "",
      otherDescription: otherDescription || "",
    });

    await expense.save();

    const savedExpense = await Expense.findById(expense._id)
      .populate("ExpenseTypeID", "ExpenseTypeName")
      .populate("ExpenseCategoryId", "ExpenseCategoryName")
      .populate("PhysioId", "physioName")
      .populate("ReferenceId", "sourceName")
      .populate("PatientId", "patientName")
      .populate("MachineiId", "machineName");

    return res.status(201).json({
      message: "Expense created successfully",
      data: savedExpense,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Get All Expense
exports.getAllExpense = async (req, res) => {
  try {
    const expenses = await Expense.find()
      .populate("ExpenseTypeID", "ExpenseTypeName")
      .populate("ExpenseCategoryId", "ExpenseCategoryName")
      .populate("PhysioId", "physioName")
      .populate("ReferenceId", "sourceName")
      .populate("PatientId", "patientName")
      .populate("MachineiId", "machineName")
      .sort({ expenseDate: -1, createdAt: -1 });

    return res.status(200).json({
      message: "Expenses fetched successfully",
      data: expenses,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Get Single Expense
exports.getSingleExpense = async (req, res) => {
  try {
    const { _id } = req.body;

    if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Valid expense id is required" });
    }

    const expense = await Expense.findById(_id)
      .populate("ExpenseTypeID", "ExpenseTypeName")
      .populate("ExpenseCategoryId", "ExpenseCategoryName")
      .populate("PhysioId", "physioName")
      .populate("ReferenceId", "sourceName")
      .populate("PatientId", "patientName")
      .populate("MachineiId", "machineName");

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    return res.status(200).json({
      message: "Expense fetched successfully",
      data: expense,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
exports.getWeeklyRevenue = async (req, res) => {
  try {
    const today = new Date();

    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);

    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    const now = new Date();
    now.setHours(23, 59, 59, 999);

    const sessions = await Session.find({
      sessionDate: { $gte: monday, $lte: now },
    }).populate({
      path: "patientId",
      select: "patientName feeAmount FeesTypeId",
      populate: {
        path: "FeesTypeId",
        select: "feesTypeName",
      },
    });

    const revenue = {
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
      Sunday: 0,
    };

    let todayRevenue = 0;

    const todayName = new Date().toLocaleDateString("en-US", {
      weekday: "long",
    });

    const completedStatusId = "691ec69eae0e10763c8f21e0";

    sessions.forEach((session, index) => {
      const patient = session.patientId;

      // skip if not completed
      if (session.sessionStatusId.toString() !== completedStatusId) {
        return;
      }

      const feeType = patient?.FeesTypeId?.feesTypeName || "Unknown";
      const feeAmount = patient?.feeAmount || 0;

      let feePerSession = 0;

      if (feeType === "PerSession") {
        feePerSession = feeAmount;
      }

      if (feeType === "PerMonth") {
        feePerSession = Math.round(feeAmount / 26);
      }

      // get session day
      const sessionDay = new Date(session.sessionDate).toLocaleDateString(
        "en-US",
        { weekday: "long" },
      );

      // add to correct weekday revenue
      if (revenue[sessionDay] !== undefined) {
        revenue[sessionDay] += feePerSession;
      }

      // today revenue
      if (sessionDay === todayName) {
        todayRevenue += feePerSession;
      }
    });

    // cumulative weekly revenue
    let total = 0;

    const cumulative = Object.keys(revenue).map((day) => {
      total += revenue[day];

      return {
        day,
        revenue: total,
      };
    });

    res.json({
      success: true,
      todayRevenue: todayRevenue,
      weeklyDayWiseRevenue: revenue,
      cumulativeRevenue: cumulative,
    });
  } catch (error) {
    console.log("Error:", error);

    res.status(500).json({
      success: false,
    });
  }
};
exports.getMonthlyNetProfit = async (req, res) => {
  try {
    const year = new Date().getFullYear();

    // Helper to get month name
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    // Initialize monthly totals
    const incomeByMonth = {};
    const expenseByMonth = {};
    months.forEach((m) => {
      incomeByMonth[m] = 0;
      expenseByMonth[m] = 0;
    });

    // Get all sessions for this year
    const sessions = await Session.find({
      sessionDate: {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31`),
      },
    }).populate({
      path: "patientId",
      select: "feeAmount FeesTypeId",
      populate: { path: "FeesTypeId", select: "feesTypeName" },
    });

    // Completed session status
    const completedStatusId = "691ec69eae0e10763c8f21e0";

    // Aggregate income per month
    sessions.forEach((session) => {
      if (session.sessionStatusId.toString() !== completedStatusId) return;

      const patient = session.patientId;
      if (!patient) return;

      const feeType = patient.FeesTypeId?.feesTypeName || "Unknown";
      const feeAmount = patient.feeAmount || 0;

      let feePerSession =
        feeType === "PerMonth" ? Math.round(feeAmount / 26) : feeAmount;

      const month = new Date(session.sessionDate).getMonth(); // 0-11
      const monthName = months[month];

      incomeByMonth[monthName] += feePerSession;
    });

    // Aggregate expenses per month
    const expenses = await Expense.find({
      expenseDate: {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31`),
      },
    });

    expenses.forEach((exp) => {
      const month = new Date(exp.expenseDate).getMonth();
      const monthName = months[month];
      expenseByMonth[monthName] += Number(exp.expenseAmount || 0);
    });

    // Compute net profit
    const monthlyNetProfit = months.map((m) => ({
      month: m,
      netProfit: incomeByMonth[m] - expenseByMonth[m],
    }));

    return res.status(200).json({
      success: true,
      monthlyNetProfit,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
// Update Expense
exports.updateExpense = async (req, res) => {
  try {
    const { _id, ...updateData } = req.body;

    if (!_id) {
      return res.status(400).json({
        success: false,
        message: "Expense ID is required",
      });
    }

    const updated = await Expense.findByIdAndUpdate(
      _id,
      { $set: updateData },
      { new: true },
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Expense updated successfully",
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete Expense
exports.deleteExpense = async (req, res) => {
  try {
    const { _id } = req.body;

    if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Valid expense id is required" });
    }

    const expense = await Expense.findByIdAndDelete(_id);

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    return res.status(200).json({
      message: "Expense deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
// Function to get Financial Year Summary (Apr to Mar)
exports.getFinancialYearSummary = async (req, res) => {
  try {
    const { year } = req.body; // Expecting the starting year, e.g., 2025
    const selectedYear = parseInt(year);

    // Define FY Range: April 1st of Selected Year to March 31st of Next Year
    const startOfFY = new Date(`${selectedYear}-04-01T00:00:00.000Z`);
    const endOfFY = new Date(`${selectedYear + 1}-03-31T23:59:59.999Z`);

    const fyStats = await Expense.aggregate([
      {
        $match: {
          expenseDate: { $gte: startOfFY, $lte: endOfFY },
        },
      },
      {
        $group: {
          _id: null,
          totalIncome: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$ExpenseTypeID.ExpenseTypeName", "Income"] },
                    {
                      $eq: [
                        "$ExpenseTypeID.ExpenseTypeName",
                        "Revenue from Patient",
                      ],
                    },
                  ],
                },
                "$expenseAmount",
                0,
              ],
            },
          },
          totalExpense: {
            $sum: {
              $cond: [
                { $eq: ["$ExpenseTypeID.ExpenseTypeName", "Expense"] },
                "$expenseAmount",
                0,
              ],
            },
          },
          totalSessions: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$ExpenseCategoryId.ExpenseCategoryName",
                    "Revenue from Patient",
                  ],
                },
                1,
                0,
              ],
            },
          },
          completedSessions: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $eq: [
                        "$ExpenseCategoryId.ExpenseCategoryName",
                        "Revenue from Patient",
                      ],
                    },
                    { $gt: ["$expenseAmount", 0] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const result = fyStats[0] || {
      totalIncome: 0,
      totalExpense: 0,
      totalSessions: 0,
      completedSessions: 0,
    };

    // Add SCR calculation
    const scr =
      result.totalSessions > 0
        ? ((result.completedSessions / result.totalSessions) * 100).toFixed(1)
        : 0;

    res.status(200).json({
      success: true,
      data: { ...result, scr },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
exports.getAvgRevenuePerPatientByMonth = async (req, res) => {
  try {
    const { year } = req.body;

    const selectedYear = Number(year);

    const startDate = new Date(`${selectedYear}-01-01`);
    const endDate = new Date(`${selectedYear}-12-31`);

    const data = await Expense.aggregate([
      {
        $match: {
          expenseDate: { $gte: startDate, $lte: endDate },
        },
      },

      {
        $group: {
          _id: { month: { $month: "$expenseDate" } },
          totalRevenue: {
            $sum: {
              $cond: [{ $eq: ["$type", "Income"] }, "$expenseAmount", 0],
            },
          },
          patients: { $addToSet: "$PatientId" },
        },
      },

      {
        $project: {
          month: "$_id.month",
          totalRevenue: 1,
          patientCount: { $size: "$patients" },
          avgRevenue: {
            $cond: [
              { $eq: [{ $size: "$patients" }, 0] },
              0,
              { $divide: ["$totalRevenue", { $size: "$patients" }] },
            ],
          },
        },
      },

      { $sort: { month: 1 } },
    ]);

    return res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false });
  }
};
