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
    if (!bill) {
      return res
        .status(404)
        .json({ success: false, message: "Bill not found" });
    }

    const today = new Date();
    const amountReceivedNow = Number(receivedAmount);

    if (!Number.isFinite(amountReceivedNow) || amountReceivedNow <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid receivedAmount" });
    }

    const currentReceived = Number(bill.ReceivedAmount || 0);
    const newTotalReceived = Number(
      (currentReceived + amountReceivedNow).toFixed(2),
    );

    // ✅ FIX: outstanding must use newTotalReceived
    const outstandingBalance = Number(
      (Number(bill.NetBilledAmount || 0) - newTotalReceived).toFixed(2),
    );

    // Prevent overpay
    if (newTotalReceived > Number(bill.NetBilledAmount || 0)) {
      return res.status(400).json({
        success: false,
        message: `Received exceeds NetBilledAmount (Net: ${bill.NetBilledAmount}, Received would be: ${newTotalReceived})`,
      });
    }

    if (paymentType === "Full Payment") {
      bill.ReceivedAmount = bill.NetBilledAmount;
      bill.paymentStatus = "Paid";
      bill.paymentType = "Full Payment";
      bill.isComplete = true;

      // ✅ if any credit exists for this bill, remove it
      await Credit.deleteMany({ BillId: bill._id });
    }

    if (paymentType === "Partial Payment") {
      bill.ReceivedAmount = newTotalReceived;
      bill.paymentStatus = outstandingBalance <= 0 ? "Paid" : "Partially Paid";
      bill.paymentType = "Partial Payment";
      bill.isComplete = outstandingBalance <= 0;

      // ✅ if credit exists for this bill -> UPDATE it
      const existingCredit = await Credit.findOne({ BillId: bill._id });

      if (outstandingBalance > 0) {
        if (existingCredit) {
          existingCredit.CreditAmount = outstandingBalance;
          existingCredit.CreditDate = today;
          existingCredit.Creditfeedback =
            feedback || existingCredit.Creditfeedback || "";
          existingCredit.Creditnotes =
            notes || existingCredit.Creditnotes || "Updated after payment";
          existingCredit.Creditdescription = `Outstanding balance from Bill ${bill.month} - ${bill.year}`;
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
      } else {
        // ✅ outstanding cleared -> remove credit
        if (existingCredit) {
          await Credit.deleteOne({ _id: existingCredit._id });
        }
      }
    }

    await bill.save();

    return res.status(200).json({
      success: true,
      message:
        paymentType === "Full Payment"
          ? "Bill closed successfully"
          : outstandingBalance <= 0
            ? "Payment completed and credit cleared"
            : "Partial payment recorded and credit updated",
      data: bill,
      outstandingBalance,
    });
  } catch (error) {
    console.error("Error receiving payment:", error);
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
