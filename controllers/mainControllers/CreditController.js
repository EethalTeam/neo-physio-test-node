const mongoose = require("mongoose");
const CreditPayment = require("../../model/masterModels/CreditPayment");
const Bill = require("../../model/masterModels/Bill");
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

exports.payCredit = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { creditId, receivedAmount, receivedDate, notes } = req.body;

    const payAmount = Number(receivedAmount);
    if (!mongoose.Types.ObjectId.isValid(creditId))
      return res.status(400).json({ message: "Invalid creditId" });

    if (!Number.isFinite(payAmount) || payAmount <= 0)
      return res.status(400).json({ message: "Invalid payment amount" });

    // 1) Get credit
    const credit = await CreditPayment.findById(creditId).session(session);
    if (!credit) return res.status(404).json({ message: "Credit not found" });

    if (payAmount > credit.CreditAmount)
      return res.status(400).json({
        message: `Payment exceeds credit amount (${credit.CreditAmount})`,
      });

    // 2) Update credit (minus)
    credit.CreditAmount = Number((credit.CreditAmount - payAmount).toFixed(2));
    credit.status = credit.CreditAmount === 0 ? "Paid" : "Partial";
    credit.lastReceivedAmount = payAmount;
    credit.lastReceivedDate = receivedDate
      ? new Date(receivedDate)
      : new Date();
    credit.lastNotes = notes || "";
    await credit.save({ session });

    // 3) Update bill received amount (plus)
    if (credit.BillId) {
      const bill = await Bill.findById(credit.BillId).session(session);
      if (!bill) return res.status(404).json({ message: "Bill not found" });

      bill.ReceivedAmount = Number(
        (Number(bill.ReceivedAmount || 0) + payAmount).toFixed(2),
      );

      // optional status update
      const pending = Number(
        (Number(bill.NetBilledAmount || 0) - bill.ReceivedAmount).toFixed(2),
      );
      bill.paymentStatus = pending <= 0 ? "Paid" : "Partially Paid";
      bill.isComplete = pending <= 0;

      bill.lastPaymentDate = receivedDate ? new Date(receivedDate) : new Date();
      bill.lastPaymentNotes = notes || "";
      await bill.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Payment successful",
      creditId: credit._id,
      billId: credit.BillId || null,
      remainingCredit: credit.CreditAmount,
      creditStatus: credit.status,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ message: error.message });
  }
};
