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

    // 1) load doc
    const payroll = await Payroll.findById(_id);
    if (!payroll) return res.status(404).json({ message: "Payroll not found" });

    // 2) apply only provided fields (patch)
    const normalized = normalizePayload(rest, { patch: true });
    Object.assign(payroll, normalized);

    // 3) OPTIONAL: if you want PetrolAmount always derived from km * amountperKm
    // If amountperKm exists in DB, and PetrolKm is edited, update PetrolAmount automatically
    const petrolKm = Number(payroll.PetrolKm || 0);
    const perKm = Number(payroll.amountperKm || 0);
    // uncomment if you want auto petrol calc:
    // payroll.PetrolAmount = Math.round(petrolKm * perKm);

    // 4) Leave deduction calc
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
    const year = Number(payroll.payrRollYear) || new Date().getFullYear();
    const daysInMonth =
      mIndex >= 0 ? new Date(year, mIndex + 1, 0).getDate() : 30;

    const basicSalary = Number(payroll.basicSalary || 0);
    const noOfLeave = Number(payroll.NoofLeave || 0);
    const perDay = daysInMonth ? basicSalary / daysInMonth : 0;
    const leaveDeduction = perDay * noOfLeave;

    const manual = Number(payroll.ManualDeduction || 0);

    payroll.TotalAmountDeducted = Math.round(leaveDeduction + manual);

    // 5) Total + Net salary calc (always updates when any related field changes)
    const totalSalary =
      basicSalary +
      Number(payroll.vehicleMaintanance || 0) +
      Number(payroll.PetrolAmount || 0) +
      Number(payroll.Incentive || 0);

    const netSalary =
      totalSalary -
      Number(payroll.TotalAmountDeducted || 0) -
      Number(payroll.ESI || 0) -
      Number(payroll.PF || 0);

    payroll.TotalSalary = Math.round(totalSalary);
    payroll.NetSalary = Math.round(netSalary);

    await payroll.save();

    return res.status(200).json({
      message: "Payroll updated successfully",
      data: payroll,
    });
  } catch (error) {
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
