const mongoose = require("mongoose");
const Bill = require("../../model/masterModels/Bill");
const Credit = require("../../model/masterModels/CreditPayment");
// Create a new Patient
exports.createBill = async (req, res) => {
  try {
    const {
      patientId,
      physioId,
      startDate,
      ToDate,
      ratePerSession,
      totalAmount,
      paymentType,
      ReceivedAmount,
      TotalSessionCount,
    } = req.body;
    // Check for duplicates (if needed)
    const existingBill = await Bill.findOne({
      patientId: patientId,
    });
    if (existingBill) {
      return res
        .status(400)
        .json({ message: "Bill with this Patient  already exists" });
    }
    // Create and save the Patient
    const bill = new Bill({
      patientId,
      physioId,
      startDate,
      ToDate,
      ratePerSession,
      ReceivedAmount,
      paymentType,
      totalAmount,
      TotalSessionCount,
    });
    await bill.save();

    res.status(200).json({
      message: "Bill  created successfully",
      data: bill._id,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.receivePayment = async (req, res) => {
  try {
    const { receivedAmount, billId, paymentType, notes, feedback } = req.body;

    const bill = await Bill.findById(billId);
    if (!bill)
      return res
        .status(404)
        .json({ success: false, message: "Bill not found" });

    const amountReceivedNow = Number(receivedAmount);
    if (!Number.isFinite(amountReceivedNow) || amountReceivedNow <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid receivedAmount" });
    }

    const today = new Date();

    // ✅ correct total received
    const newTotalReceived = Number(
      (Number(bill.ReceivedAmount || 0) + amountReceivedNow).toFixed(2),
    );

    // ✅ correct outstanding
    const outstandingBalance = Number(
      (Number(bill.NetBilledAmount || 0) - newTotalReceived).toFixed(2),
    );

    bill.ReceivedAmount = newTotalReceived;

    // ✅ always update status based on actual amounts
    if (newTotalReceived >= Number(bill.NetBilledAmount || 0)) {
      bill.paymentStatus = "Paid";
      bill.paymentType = "Full Payment";
      bill.isComplete = true;

      // optional: remove credit if exists
      await Credit.deleteMany({ BillId: bill._id });
    } else {
      bill.paymentStatus = "Partially Paid";
      bill.paymentType = "Partial Payment";
      bill.isComplete = false;

      // ✅ create/update credit = outstanding
      const existingCredit = await Credit.findOne({ BillId: bill._id });

      if (existingCredit) {
        existingCredit.CreditAmount = outstandingBalance;
        existingCredit.CreditDate = today;
        existingCredit.Creditfeedback =
          feedback || existingCredit.Creditfeedback || "";
        existingCredit.Creditnotes = notes || existingCredit.Creditnotes || "";
        await existingCredit.save();
      } else {
        await Credit.create({
          BillId: bill._id,
          patientId: bill.patientId,
          CreditAmount: outstandingBalance,
          CreditDate: today,
          CreditMonth: today.getMonth() + 1,
          CreditYear: today.getFullYear(),
          Creditdescription: `Outstanding balance from Bill ${bill.month} - ${bill.year}`,
          Creditfeedback: feedback || "",
          Creditnotes: notes || "System generated from partial payment",
        });
      }
    }

    await bill.save();

    return res.status(200).json({
      success: true,
      message: "Payment recorded",
      data: bill,
      outstandingBalance,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get allConsultation
exports.getAllBill = async (req, res) => {
  try {
    const bills = await Bill.find()
      .populate("physioId", "physioName")
      .populate("patientId");
    if (!bills) {
      return res.status(400).json({ message: "Bill not found" });
    }

    res.status(200).json(bills);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a consultate
exports.deleteBill = async (req, res) => {
  try {
    const { _id } = req.body;

    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const bill = await Bill.findByIdAndDelete(_id);

    if (!bill) {
      return res.status(400).json({ message: "Bill not found" });
    }

    res.status(200).json({ message: "Bill deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
