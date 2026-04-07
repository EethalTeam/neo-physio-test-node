const mongoose = require("mongoose");
const Payroll = require("../../model/masterModels/Payroll");

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
    ...num("savings", body.savings),
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

    if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    // 1. Find payroll
    const payroll = await Payroll.findById(_id);
    if (!payroll) {
      return res.status(404).json({ message: "Payroll not found" });
    }

    // 2. Update provided fields
    Object.assign(payroll, rest);

    // ==============================
    // 3. PETROL CALCULATION
    // ==============================

    const petrolKm = Number(payroll.PetrolKm || 0);
    const amountperKm = Number(payroll.amountperKm || 0);

    const petrolAmount = petrolKm * amountperKm;
    payroll.PetrolAmount = Math.round(petrolAmount);

    // ==============================
    // 4. LEAVE DEDUCTION
    // ==============================

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

    // const daysInMonth = new Date(year, mIndex + 1, 0).getDate();

    const basicSalary = Number(payroll.basicSalary || 0);
    const noOfLeave = Number(payroll.NoofLeave || 0);

    const perDaySalary = basicSalary / 30;
    const leaveDeduction = perDaySalary * noOfLeave;

    const manualDeduction = Number(payroll.ManualDeduction || 0);

    const totalDeduction = leaveDeduction + manualDeduction;

    payroll.TotalAmountDeducted = Math.round(totalDeduction);

    // ==============================
    // 5. TOTAL SALARY
    // ==============================

    const vehicleMaintanance = Number(payroll.vehicleMaintanance || 0);
    const incentive = Number(payroll.Incentive || 0);

    const totalSalary =
      basicSalary + vehicleMaintanance + payroll.PetrolAmount + incentive;

    payroll.TotalSalary = Math.round(totalSalary);

    // ==============================
    // 6. NET SALARY
    // ==============================

    const esi = Number(payroll.ESI || 0);
    const pf = Number(payroll.PF || 0);
    const savings = Number(payroll.savings || 0);

    const netSalary = totalSalary - totalDeduction - esi - pf - savings;

    payroll.NetSalary = Math.round(netSalary);

    // ==============================
    // 7. SAVE
    // ==============================

    await payroll.save();

    res.status(200).json({
      message: "Payroll updated successfully",
      data: payroll,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// DELETE
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
