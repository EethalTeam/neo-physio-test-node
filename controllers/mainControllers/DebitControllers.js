const mongoose = require("mongoose");
const DebitPayment = require("../../model/masterModels/DebitPayment");

exports.createDebitPayment = async (req, res) => {
  try {
    const {
      patientId,
      DebitAmount,
      DebitDate,
      Debitdescription,
      Debitfeedback,
      Debitnotes,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: "Invalid patientId" });
    }

    const amount = Number(DebitAmount || 0);
    if (amount <= 0) {
      return res.status(400).json({ message: "Invalid DebitAmount" });
    }

    const dateObj = DebitDate ? new Date(DebitDate) : new Date();
    const DebitMonth = dateObj.getMonth() + 1;
    const DebitYear = dateObj.getFullYear();

    const existing = await DebitPayment.findOne({
      patientId,
      DebitMonth,
      DebitYear,
    });

    if (existing) {
      existing.DebitAmount += amount;

      existing.DebitDate = dateObj;

      if (Debitdescription) existing.Debitdescription = Debitdescription;
      if (Debitfeedback) existing.Debitfeedback = Debitfeedback;
      if (Debitnotes) existing.Debitnotes = Debitnotes;

      await existing.save();

      return res.status(200).json({
        message: "Debit updated successfully",
        data: existing,
      });
    }

    const debit = await DebitPayment.create({
      patientId,
      DebitAmount: amount,
      DebitDate: dateObj,
      DebitMonth,
      DebitYear,
      Debitdescription,
      Debitfeedback,
      Debitnotes,
    });

    res.status(201).json({
      message: "Debit created successfully",
      data: debit,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.getAllDebitPayment = async (req, res) => {
  try {
    const debits = await DebitPayment.find()
      .populate("patientId", "patientName patientCode")
      .sort({ createdAt: -1 });

    res.status(200).json(debits);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.updateDebitPayment = async (req, res) => {
  try {
    const {
      _id,
      patientId,
      DebitAmount,
      DebitDate,
      DebitMonth,
      DebitYear,
      Debitdescription,
      Debitfeedback,
      Debitnotes,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const updated = await DebitPayment.findByIdAndUpdate(
      _id,
      {
        $set: {
          patientId,
          DebitAmount,
          DebitDate,
          DebitMonth,
          DebitYear,
          Debitdescription,
          Debitfeedback,
          Debitnotes,
        },
      },
      { new: true, runValidators: true },
    );

    if (!updated) {
      return res.status(404).json({ message: "Debit not found" });
    }

    res.status(200).json({
      message: "Debit updated successfully",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.deleteDebitPayment = async (req, res) => {
  try {
    const { _id } = req.body;

    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const deleted = await DebitPayment.findByIdAndDelete(_id);

    if (!deleted) {
      return res.status(404).json({ message: "Debit not found" });
    }

    res.status(200).json({ message: "Debit deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
