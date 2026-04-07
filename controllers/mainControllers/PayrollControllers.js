const mongoose = require("mongoose");
const Payroll = require("../../model/masterModels/Payroll");
const Session = require("../../model/masterModels/Session");
const LeaveModel = require("../../model/masterModels/Leave");
// Small helper: allow both old + new field names
function normalizePayload(body, { patch = false } = {}) {
  // helper: only include key if present in request (patch mode)
  const pick = (key, value) => {
    if (patch && value === undefined) return {};
    return { [key]: value };
  };

  // helper: number conversion only if present (patch mode)
  const num = (key, value) => {
    if (patch && value === undefined) return {};
    const n = Number(value);
    return { [key]: Number.isFinite(n) ? n : 0 }; // for create, fallback to 0
  };

  return {
    ...pick("physioId", body.physioId),

    ...pick("payrRollMonth", body.payrRollMonth ?? body.month),
    ...pick("payrRollYear", body.payrRollYear ?? body.year),
    ...pick("payRollDate", body.payRollDate ?? body.Date ?? body.date),

    ...num(
      "payrRollCompletedSessions",
      body.payrRollCompletedSessions ?? body.completedSession,
    ),
    ...num(
      "payrRollCancelledSession",
      body.payrRollCancelledSession ?? body.cancelledSession,
    ),
    ...num("ManualDeduction", body.ManualDeduction ?? body.manualDeduction),

    ...num("PetrolKm", body.PetrolKm),
    ...num("PetrolAmount", body.PetrolAmount),
    ...num("amountperKm", body.amountperKm),

    ...num("basicSalary", body.basicSalary),
    ...num("vehicleMaintanance", body.vehicleMaintanance),
    ...num("Incentive", body.Incentive),

    ...num("NoofLeave", body.NoofLeave),
    ...num("TotalAmountDeducted", body.TotalAmountDeducted),

    ...num("ESI", body.ESI),
    ...num("PF", body.PF),

    ...num("TotalSalary", body.TotalSalary),
    ...num("NetSalary", body.NetSalary),
  };
}

// ✅ CREATE (manual)
exports.createPayroll = async (req, res) => {
  try {
    const payload = normalizePayload(req.body);

    if (!payload.physioId || !payload.payrRollMonth || !payload.payrRollYear) {
      return res.status(400).json({
        message:
          "physioId, payrRollMonth (or month), payrRollYear (or year) are required",
      });
    }

    // If payRollDate not provided, set now
    if (!payload.payRollDate) payload.payRollDate = new Date();

    // Prevent duplicates for same physio + month + year
    const existing = await Payroll.findOne({
      physioId: payload.physioId,
      payrRollMonth: payload.payrRollMonth,
      payrRollYear: payload.payrRollYear,
    });

    if (existing) {
      return res.status(400).json({
        message: "Payroll already exists for this physio in this month/year",
      });
    }

    const created = await Payroll.create(payload);

    return res.status(201).json({
      message: "Payroll created successfully",
      data: created,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ READ ALL (with optional filters)
exports.getAllPayroll = async (req, res) => {
  try {
    const { month, year, physioId } = req.body || {};

    const query = {};
    if (month) query.payrRollMonth = month;
    if (year) query.payrRollYear = Number(year);
    if (physioId) query.physioId = physioId;

    const payrolls = await Payroll.find(query)
      .populate({
        path: "physioId",
        select: "physioName physioSpcl roleId",
        populate: { path: "roleId", select: "RoleName" },
      })
      .sort({ createdAt: -1 });

    return res.status(200).json(payrolls);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ READ ONE (by id)
exports.getPayrollById = async (req, res) => {
  try {
    const { _id } = req.body;

    if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const payroll = await Payroll.findById(_id).populate(
      "physioId",
      "physioName physioSpcl roleId",
    );

    if (!payroll) {
      return res.status(404).json({ message: "Payroll not found" });
    }

    return res.status(200).json(payroll);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updatePayroll = async (req, res) => {
  try {
    const { _id, ...rest } = req.body;

    const payroll = await Payroll.findById(_id).populate("physioId");
    if (!payroll) return res.status(404).json({ message: "Payroll not found" });

    // 1) SYNC INCOMING DATA
    // Using your existing normalization logic
    const normalized = normalizePayload(rest, { patch: true });
    Object.assign(payroll, normalized);

    // 2) DATE RANGE & PER DAY RATE
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const mIndex = months.indexOf(payroll.payrRollMonth);
    const year = Number(payroll.payrRollYear);

    // Standardized to UTC to prevent "Date Shifting" which causes wrong leave counts
    const startRange = new Date(Date.UTC(year, mIndex - 1, 21, 0, 0, 0));
    const endRange = new Date(Date.UTC(year, mIndex, 20, 23, 59, 59));
    const daysInMonth = new Date(year, mIndex + 1, 0).getDate();

    // 3) SESSIONS & LEAVES (Your Original Aggregation Logic)
    const sessionDaysAgg = await Session.aggregate([
      {
        $match: {
          physioId: payroll.physioId._id,
          sessionDate: { $gte: startRange, $lte: endRange },
          sessionStatusId: new mongoose.Types.ObjectId(
            "691ec69eae0e10763c8f21e0",
          ),
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$sessionDate" } },
        },
      },
      { $count: "uniqueDays" },
    ]);
    const completedSessionDays = sessionDaysAgg[0]?.uniqueDays || 0;

    const totalsessionsDays = await Session.aggregate([
      {
        $match: {
          sessionDate: { $gte: startRange, $lte: endRange },
          sessionStatusId: new mongoose.Types.ObjectId(
            "691ec69eae0e10763c8f21e0",
          ),
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$sessionDate" } },
        },
      },
      { $count: "uniqueDays" },
    ]);
    const TotalcompletedSessionDays = totalsessionsDays[0]?.uniqueDays || 0;

    const allLeaves = await LeaveModel.find({
      physioId: payroll.physioId._id,
      LeaveDate: { $gte: startRange, $lte: endRange },
      isActive: true,
    });

    let paidLeavesCount = 0;
    let unpaidLeavesCount = 0;

    allLeaves.forEach((leave) => {
      // Ensure "Half Day" matches your DB string exactly (case-sensitive)
      const weight = leave.LeaveMode === "Half Day" ? 0.5 : 1;
      if (leave.PaidLeave) {
        paidLeavesCount += weight;
      } else {
        unpaidLeavesCount += weight;
      }
    });

    // 4) BASIC SALARY CALCULATION
    const totalworkingDays =
      TotalcompletedSessionDays + paidLeavesCount + unpaidLeavesCount;
    const totalAttended = completedSessionDays + paidLeavesCount;

    const basicSalary = Number(
      payroll.basicSalary || payroll.physioId.physioSalary || 0,
    );
    const perDayRate = basicSalary / daysInMonth;
    const earnedBasicSalary = Math.round(perDayRate * totalAttended);

    // 5) ADDITIONS (Petrol, Savings, Maintenance, Incentive)
    const petrolKm = Number(payroll.PetrolKm || 0);
    const ratePerKm = Number(payroll.amountperKm || 0);
    const calculatedPetrolAmt = Math.round(petrolKm * ratePerKm);
    payroll.PetrolAmount = calculatedPetrolAmt;

    // SAVINGS FAILSAFE: Check both casing possibilities from the request
    const incomingSavings =
      req.body.Savings !== undefined ? req.body.Savings : req.body.savings;
    const savingsAmt = Number(incomingSavings ?? payroll.savings ?? 0);

    const vehicleMaint = Number(payroll.vehicleMaintanance || 0);
    const incentiveAmt = Number(payroll.Incentive || 0);
    const manualDeduction = Number(payroll.ManualDeduction || 0);

    // Calculation: (Basic + MTC + Petrol + Incentive + Savings)
    const totalSalary =
      earnedBasicSalary +
      vehicleMaint +
      calculatedPetrolAmt +
      incentiveAmt +
      savingsAmt;

    // Net Salary: (Total - Manual Deductions - Statutory)
    const netSalary =
      totalSalary -
      manualDeduction -
      Number(payroll.ESI || 0) -
      Number(payroll.PF || 0);

    // 6) STORE FINAL VALUES (Syncing all possible schema field names)
    payroll.Savings = savingsAmt;
    payroll.savings = savingsAmt;
    payroll.TotalSalary = Math.round(totalSalary);
    payroll.NetSalary = Math.round(netSalary);
    payroll.totalWorkingDays = totalworkingDays;
    payroll.attendedDays = totalAttended;
    payroll.NoofLeave = unpaidLeavesCount;
    payroll.PaidLeaves = paidLeavesCount; // Explicitly update this for the UI
    payroll.TotalLeaves = allLeaves.length;

    await payroll.save();

    return res.status(200).json({
      message: `Payroll updated. Total Salary: ₹${payroll.TotalSalary} (Includes ₹${savingsAmt} savings)`,
      data: payroll,
    });
  } catch (error) {
    console.error("Update Error:", error);
    return res.status(500).json({ message: error.message });
  }
};
// ✅ DELETE
exports.deletePayroll = async (req, res) => {
  try {
    const { _id } = req.body;

    if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const deleted = await Payroll.findByIdAndDelete(_id);

    if (!deleted) {
      return res.status(404).json({ message: "Payroll not found" });
    }

    return res.status(200).json({ message: "Payroll deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ UPSERT (important for cron) - create if not exists, else update
exports.upsertPayroll = async (req, res) => {
  try {
    const payload = normalizePayload(req.body);

    if (!payload.physioId || !payload.payrRollMonth || !payload.payrRollYear) {
      return res.status(400).json({
        message:
          "physioId, payrRollMonth (or month), payrRollYear (or year) are required",
      });
    }

    if (!payload.payRollDate) payload.payRollDate = new Date();

    const updated = await Payroll.findOneAndUpdate(
      {
        physioId: payload.physioId,
        payrRollMonth: payload.payrRollMonth,
        payrRollYear: payload.payrRollYear,
      },
      { $set: payload },
      { upsert: true, new: true, runValidators: true },
    );

    return res.status(200).json({
      message: "Payroll upserted successfully",
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
