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
        select: "physioName physioSpcl",
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
    if (!payroll) {
      return res.status(404).json({ message: "Payroll not found" });
    }

    const normalized = normalizePayload(rest, { patch: true });
    Object.assign(payroll, normalized);

    console.log("\n========== PAYROLL DEBUG START ==========");

    // ---------------- MONTH SETUP ----------------
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

    const startRange = new Date(Date.UTC(year, mIndex - 1, 21));
    const endRange = new Date(Date.UTC(year, mIndex, 20, 23, 59, 59));

    console.log("MONTH:", payroll.payrRollMonth);
    console.log("YEAR:", year);

    // ---------------- ROLE ----------------
    const roleName = payroll.physioId?.physioSpcl; // or roleId.RoleName if available
    const joinDate = new Date(payroll.physioId?.createdAt);

    console.log("ROLE:", roleName);
    console.log("JOIN DATE:", joinDate);

    // =========================================================
    // 🟢 HOD LOGIC (NO SESSION DEPENDENCY)
    // =========================================================
    // ---------------- HOD LOGIC (FINAL FIXED) ----------------
    if (roleName === "HEAD OF THE DEPARTMENT") {
      console.log(">>> HOD FLOW ACTIVE");

      const basicSalary = Number(payroll.physioId.physioSalary || 0);

      // IMPORTANT: round per day rate
      const perDay = basicSalary / 30;

      const grossSalary = basicSalary;

      const leaves = await LeaveModel.find({
        physioId: payroll.physioId._id,
        LeaveDate: { $gte: startRange, $lte: endRange },
        isActive: true,
      });

      let paid = 0;
      let unpaid = 0;

      leaves.forEach((l) => {
        const w = l.LeaveMode === "Half Day" ? 0.5 : 1;
        if (l.PaidLeave) paid += w;
        else unpaid += w;
      });

      // IMPORTANT: round deduction properly
      const unpaidDeduction = unpaid * perDay;

      const manualDeduction = Number(payroll.ManualDeduction || 0);
      const esi = Number(payroll.ESI || 0);
      const pf = Number(payroll.PF || 0);

      const totalDeduction = unpaidDeduction + manualDeduction + esi + pf;

      const netSalary = grossSalary - totalDeduction;

      console.log("HOD GROSS:", grossSalary);
      console.log("PER DAY:", perDay);
      console.log("UNPAID DEDUCTION:", unpaidDeduction);
      console.log("TOTAL DEDUCTION:", totalDeduction);
      console.log("NET SALARY:", netSalary);

      payroll.TotalSalary = Math.round(grossSalary);
      payroll.TotalAmountDeducted = Math.round(totalDeduction);
      payroll.NetSalary = Math.round(netSalary);

      payroll.PaidLeaves = paid;
      payroll.NoofLeave = unpaid;
      payroll.TotalLeaves = paid + unpaid;

      await payroll.save();

      return res.status(200).json({
        message: "HOD Payroll updated successfully",
        data: payroll,
      });
    }

    // =========================================================
    // 🟡 PHYSIO LOGIC (UNCHANGED - YOUR ORIGINAL SYSTEM)
    // =========================================================

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
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$sessionDate" },
          },
        },
      },
      { $count: "uniqueDays" },
    ]);

    const completedSessionDays = sessionDaysAgg[0]?.uniqueDays || 0;

    const allLeaves = await LeaveModel.find({
      physioId: payroll.physioId._id,
      LeaveDate: { $gte: startRange, $lte: endRange },
      isActive: true,
    });

    let paidLeaves = 0;
    let unpaidLeaves = 0;

    allLeaves.forEach((l) => {
      const w = l.LeaveMode === "Half Day" ? 0.5 : 1;
      if (l.PaidLeave) paidLeaves += w;
      else unpaidLeaves += w;
    });

    const basicSalary = Number(payroll.physioId.physioSalary || 0);
    const perDayRate = basicSalary / 30;

    const attendedDays = completedSessionDays + paidLeaves;
    const earnedBasicSalary = Math.round(perDayRate * attendedDays);

    const petrol =
      Number(payroll.PetrolKm || 0) * Number(payroll.amountperKm || 0);

    const savings = Number(payroll.savings || 0);
    const vehicle = Number(payroll.vehicleMaintanance || 0);
    const incentive = Number(payroll.Incentive || 0);

    const gross = earnedBasicSalary + petrol + savings + vehicle + incentive;

    const unpaidDeduction = unpaidLeaves * perDayRate;

    const deductions =
      unpaidDeduction +
      Number(payroll.ManualDeduction || 0) +
      Number(payroll.ESI || 0) +
      Number(payroll.PF || 0);

    const net = gross - deductions;

    payroll.attendedDays = attendedDays;
    payroll.PaidLeaves = paidLeaves;
    payroll.NoofLeave = unpaidLeaves;
    payroll.TotalLeaves = paidLeaves + unpaidLeaves;

    payroll.TotalSalary = Math.round(gross);
    payroll.TotalAmountDeducted = Math.round(deductions);
    payroll.NetSalary = Math.round(net);

    await payroll.save();

    return res.status(200).json({
      message: "Physio Payroll updated successfully",
      data: payroll,
    });
  } catch (error) {
    console.error(error);
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
