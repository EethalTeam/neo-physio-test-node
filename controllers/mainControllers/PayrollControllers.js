const mongoose = require("mongoose");
const Payroll = require("../../model/masterModels/Payroll");

// CREATE
exports.createPayroll = async (req, res) => {
  try {
    const {
      physioId,
      month,
      year,
      Date,
      completedSession,
      cancelledSession,
      PetrolKm,
      PetrolAmount,
      basicSalary,
      vehicleMaintanance,
      ESI,
      PF,
      Incentive,
      amountperKm,
    } = req.body;

    if (!physioId || !month || !year || !Date) {
      return res
        .status(400)
        .json({ message: "physioId, month, year, Date are required" });
    }

    const existing = await Payroll.findOne({ physioId, month, year });
    if (existing) {
      return res.status(400).json({
        message: "Payroll already exists for this physio in this month/year",
      });
    }

    const payroll = await Payroll.create({
      physioId,
      month,
      year,
      Date,
      completedSession,
      cancelledSession,
      PetrolKm,
      PetrolAmount,
      basicSalary,
      vehicleMaintanance,
      ESI,
      PF,
      Incentive,
      amountperKm,
    });

    res.status(201).json({
      message: "Payroll created successfully",
      data: payroll,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// READ ALL
exports.getAllPayroll = async (req, res) => {
  try {
    const payrolls = await Payroll.find()
      .populate("physioId", "physioName")
      .sort({ createdAt: -1 });

    res.status(200).json(payrolls);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE
exports.updatePayroll = async (req, res) => {
  try {
    const { _id, ...update } = req.body;

    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    delete update.createdAt;
    delete update.updatedAt;

    const updated = await Payroll.findByIdAndUpdate(
      _id,
      { $set: update },
      { new: true, runValidators: true },
    );

    if (!updated) {
      return res.status(404).json({ message: "Payroll not found" });
    }

    res.status(200).json({
      message: "Payroll updated successfully",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE
exports.deletePayroll = async (req, res) => {
  try {
    const { _id } = req.body;

    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const deleted = await Payroll.findByIdAndDelete(_id);
    if (!deleted) {
      return res.status(404).json({ message: "Payroll not found" });
    }

    res.status(200).json({ message: "Payroll deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
