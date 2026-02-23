const mongoose = require("mongoose");
const CreditPayment = require("../../model/masterModels/CreditPayment");

// Create
exports.createCreditPayment = async (req, res) => {
  try {
    const {
      patientId,
      CreditAmount,
      CreditDate,
      CreditMonth,
      CreditYear,
      Creditdescription,
      Creditfeedback,
      Creditnotes,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: "Invalid patientId" });
    }

    const existing = await CreditPayment.findOne({
      patientId,
      CreditMonth,
      CreditYear,
    });

    if (existing) {
      return res.status(400).json({
        message: "Credit for this patient/month/year already exists",
      });
    }

    const credit = await CreditPayment.create({
      patientId,
      CreditAmount,
      CreditDate,
      CreditMonth,
      CreditYear,
      Creditdescription,
      Creditfeedback,
      Creditnotes,
    });

    res.status(201).json({
      message: "Credit created successfully",
      data: credit,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllCreditPayment = async (req, res) => {
  try {
    const credits = await CreditPayment.find()
      .populate("patientId", "patientName patientCode")
      .sort({ createdAt: -1 });

    res.status(200).json(credits);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateCreditPayment = async (req, res) => {
  try {
    const {
      _id,
      patientId,
      CreditAmount,
      CreditDate,
      CreditMonth,
      CreditYear,
      Creditdescription,
      Creditfeedback,
      Creditnotes,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const updated = await CreditPayment.findByIdAndUpdate(
      _id,
      {
        $set: {
          patientId,
          CreditAmount,
          CreditDate,
          CreditMonth,
          CreditYear,
          Creditdescription,
          Creditfeedback,
          Creditnotes,
        },
      },
      { new: true, runValidators: true },
    );

    if (!updated) {
      return res.status(404).json({ message: "Credit not found" });
    }

    res.status(200).json({
      message: "Credit updated successfully",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteCreditPayment = async (req, res) => {
  try {
    const { _id } = req.body;

    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const deleted = await CreditPayment.findByIdAndDelete(_id);

    if (!deleted) {
      return res.status(404).json({ message: "Credit not found" });
    }

    res.status(200).json({ message: "Credit deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
