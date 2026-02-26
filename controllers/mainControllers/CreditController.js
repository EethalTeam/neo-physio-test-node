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
    const { creditId, _id, receivedAmount, amount, receivedDate, notes } =
      req.body;

    const payAmount = Number(amount ?? receivedAmount);

    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Invalid payment amount" });
    }

    const finalCreditId = creditId || _id;
    if (!mongoose.Types.ObjectId.isValid(finalCreditId)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Invalid creditId" });
    }

    // 1) Find credit
    const credit = await CreditPayment.findById(finalCreditId).session(session);
    if (!credit) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Credit record not found" });
    }

    // Treat CreditAmount as remaining if CreditRemaining not present
    const remaining = Number(credit.CreditAmount ?? credit.CreditAmount ?? 0);

    if (!Number.isFinite(remaining) || remaining <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "No remaining credit to pay" });
    }

    if (payAmount > remaining) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: `Payment exceeds remaining credit (${remaining})`,
      });
    }

    // 2) Deduct from credit
    const newRemaining = Number((remaining - payAmount).toFixed(2));

    credit.CreditAmount = newRemaining; // keep if exists
    credit.CreditPaidTotal = Number(
      ((credit.CreditPaidTotal || 0) + payAmount).toFixed(2),
    );
    credit.status = newRemaining === 0 ? "Paid" : "Partial";

    credit.lastReceivedAmount = payAmount;
    credit.lastReceivedDate = receivedDate
      ? new Date(receivedDate)
      : new Date();
    credit.lastNotes = notes || "";

    await credit.save({ session });

    // 3) Update bill received amount
    if (credit.BillId && mongoose.Types.ObjectId.isValid(credit.BillId)) {
      const bill = await Bill.findById(credit.BillId).session(session);

      if (!bill) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: "Linked bill not found" });
      }

      // ✅ Support both field names safely
      const billReceivedNow = Number(
        bill.receivedAmount ?? bill.ReceivedAmount ?? 0,
      );
      const newBillReceived = Number((billReceivedNow + payAmount).toFixed(2));

      if (bill.receivedAmount !== undefined)
        bill.receivedAmount = newBillReceived;
      if (bill.ReceivedAmount !== undefined)
        bill.ReceivedAmount = newBillReceived;

      // If total exists, calculate pending + status (supports both names)
      const billTotal = bill.totalAmount ?? bill.TotalAmount;
      if (billTotal != null) {
        const total = Number(billTotal || 0);
        const pending = Number((total - newBillReceived).toFixed(2));

        if (bill.pendingAmount !== undefined) bill.pendingAmount = pending;
        if (bill.PendingAmount !== undefined) bill.PendingAmount = pending;

        bill.status = pending <= 0 ? "Paid" : "Partial";
      }

      bill.lastPaymentDate = receivedDate ? new Date(receivedDate) : new Date();
      bill.lastPaymentNotes = notes || "";

      await bill.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Credit payment successful & Bill updated",
      creditId: credit._id,
      billId: credit.BillId || null,
      CreditAmount: credit.CreditAmount ?? credit.CreditAmount,
      creditStatus: credit.status,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ message: error.message });
  }
};
