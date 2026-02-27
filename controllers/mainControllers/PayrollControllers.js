const mongoose = require("mongoose");
const Payroll = require("../../model/masterModels/Payroll");

// Small helper: allow both old + new field names
function normalizePayload(body) {
  return {
    physioId: body.physioId,

    // month/year/date (support both naming styles)
    payrRollMonth: body.payrRollMonth || body.month,
    payrRollYear: body.payrRollYear || body.year,
    payRollDate: body.payRollDate || body.Date || body.date,

    // sessions
    payrRollCompletedSessions:
      body.payrRollCompletedSessions || body.completedSession || 0,
    payrRollCancelledSession:
      body.payrRollCancelledSession || body.cancelledSession || 0,

    // petrol
    PetrolKm: body.PetrolKm || 0,
    PetrolAmount: body.PetrolAmount || 0,
    amountperKm: body.amountperKm || 0,

    // salary components
    basicSalary: body.basicSalary || 0,
    vehicleMaintanance: body.vehicleMaintanance || 0,
    Incentive: body.Incentive || 0,

    // leave/deductions
    NoofLeave: body.NoofLeave || 0,
    TotalAmountDeducted: body.TotalAmountDeducted || 0,

    // statutory
    ESI: body.ESI || 0,
    PF: body.PF || 0,

    // totals
    TotalSalary: body.TotalSalary || 0,
    NetSalary: body.NetSalary || 0,
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

// ✅ UPDATE
exports.updatePayroll = async (req, res) => {
  try {
    const { _id, ...rest } = req.body;

    if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    // normalize any incoming fields
    const normalized = normalizePayload(rest);

    // Remove undefined keys so they don’t overwrite existing values
    Object.keys(normalized).forEach((k) => {
      if (normalized[k] === undefined) delete normalized[k];
    });

    // Avoid updating identity keys if you don't want
    // delete normalized.physioId;
    // delete normalized.payrRollMonth;
    // delete normalized.payrRollYear;

    const updated = await Payroll.findByIdAndUpdate(
      _id,
      { $set: normalized },
      { new: true, runValidators: true },
    );

    if (!updated) {
      return res.status(404).json({ message: "Payroll not found" });
    }

    return res.status(200).json({
      message: "Payroll updated successfully",
      data: updated,
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
