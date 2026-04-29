const mongoose = require("mongoose");
const Payroll = require("../../model/masterModels/Payroll");
const Session = require("../../model/masterModels/Session");
const LeaveModel = require("../../model/masterModels/Leave");
// Small helper: allow both old + new field names
function normalizePayload(payload, { patch = false } = {}) {
  const cleaned = {};

  for (const key in payload) {
    let value = payload[key];

    // ❌ DON'T remove valid values like 0
    if (value === null || value === undefined) continue;

    // convert numeric strings → number
    if (typeof value === "string" && value.trim() !== "") {
      const num = Number(value);
      if (!isNaN(num)) value = num;
    }

    cleaned[key] = value;
  }

  return cleaned;
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

    // ---------------- NORMALIZE ----------------
    const normalized = normalizePayload(rest, { patch: true });
    Object.assign(payroll, normalized);

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

    // ---------------- JOIN DATE ----------------
    const joinDate = new Date(payroll.physioId?.JoiningDate);

    const cleanJoinDate = new Date(
      Date.UTC(
        joinDate.getUTCFullYear(),
        joinDate.getUTCMonth(),
        joinDate.getUTCDate(),
      ),
    );

    const effectiveStart =
      cleanJoinDate > startRange ? cleanJoinDate : startRange;

    const effectiveEnd = endRange;

    // ---------------- TOTAL DAYS ----------------
    let totalDays;

    // if joining date is inside payroll cycle
    if (cleanJoinDate >= startRange && cleanJoinDate <= endRange) {
      totalDays =
        Math.floor((effectiveEnd - cleanJoinDate) / (1000 * 60 * 60 * 24)) + 1;
    } else {
      // full cycle employee
      totalDays = 30;
    }

    if (totalDays <= 0) {
      return res.status(400).json({
        message: "Invalid payroll period",
      });
    }

    // ---------------- COMMON VALUES ----------------
    const basicSalary = Number(payroll.physioId.physioSalary || 0);
    const perDayRate = basicSalary / 30;

    const petrol =
      Number(payroll.PetrolKm || 0) * Number(payroll.amountperKm || 0);

    payroll.PetrolAmount = Math.round(petrol);

    const savings = Number(payroll.savings ?? 0);
    const vehicle = Number(payroll.vehicleMaintanance ?? 0);
    const incentive = Number(payroll.Incentive ?? 0);

    // ---------------- LEAVES ----------------
    const leaves = await LeaveModel.find({
      physioId: payroll.physioId._id,
      LeaveDate: { $gte: effectiveStart, $lte: endRange },
      isActive: true,
    });

    let paidLeaves = 0;
    let unpaidLeaves = 0;

    leaves.forEach((l) => {
      const w = l.LeaveMode === "Half Day" ? 0.5 : 1;
      if (l.PaidLeave) paidLeaves += w;
      else unpaidLeaves += w;
    });

    // ---------------- SALARY ----------------

    // Full salary for period
    const earnedBasicSalary = Math.round(perDayRate * totalDays);

    // Leave deduction
    const leaveDeduction = unpaidLeaves * perDayRate;
    const userManual = Number(normalized.ManualDeduction ?? 0);

    const finalManualDeduction = userManual + leaveDeduction;
    // 🔥 IMPORTANT: get user manual deduction separately
    console.log(userManual, "userManual", "leaveDeduction", leaveDeduction);
    // 👉 FINAL manual deduction includes leave

    console.log(finalManualDeduction, finalManualDeduction);
    const gross = earnedBasicSalary + petrol + savings + vehicle + incentive;

    const deductions =
      finalManualDeduction + Number(payroll.ESI || 0) + Number(payroll.PF || 0);

    const net = gross - deductions;
    console.log(
      totalDays,

      "-",
      unpaidLeaves,
      "=",
      payroll.attendedDays,
    );
    // ---------------- SAVE ----------------
    payroll.attendedDays = totalDays - unpaidLeaves;

    payroll.ManualDeduction = Math.round(finalManualDeduction);

    payroll.PaidLeaves = paidLeaves;
    payroll.NoofLeave = unpaidLeaves;
    payroll.TotalLeaves = paidLeaves + unpaidLeaves;

    payroll.TotalSalary = Math.round(gross);
    payroll.TotalAmountDeducted = Math.round(deductions);
    payroll.NetSalary = Math.round(net);
    payroll.totalWorkingDays = totalDays;

    await payroll.save();

    return res.status(200).json({
      message: "Payroll updated successfully",
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
