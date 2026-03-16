const mongoose = require("mongoose");
const Bill = require("../../model/masterModels/Bill");
const Credit = require("../../model/masterModels/CreditPayment");
const Session = require("../../model/masterModels/Session");
const Debit = require("../../model/masterModels/DebitPayment");
const Patient = require("../../model/masterModels/Patient");

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

const COMPLETED_STATUS_ID = "691ec69eae0e10763c8f21e0";

exports.generateBillForRecoveredPatient = async (patientId) => {
  try {
    const patient = await Patient.findById(patientId).populate("FeesTypeId");
    if (!patient) {
      throw new Error("Patient not found");
    }

    const unbilledCompletedSessions = await Session.find({
      patientId: patient._id,
      sessionStatusId: new mongoose.Types.ObjectId(COMPLETED_STATUS_ID),
      isBilled: false,
    }).sort({ sessionDate: 1 });

    if (!unbilledCompletedSessions.length) {
      return {
        success: false,
        message: "No unbilled completed sessions found for this patient",
      };
    }

    const physioId = unbilledCompletedSessions[0]?.physioId || patient.physioId;
    if (!physioId) {
      throw new Error("Physio not found for billing");
    }

    const sessionIds = unbilledCompletedSessions.map((s) => s._id);
    const totalSessionCount = unbilledCompletedSessions.length;
    const firstDate = unbilledCompletedSessions[0].sessionDate;
    const lastDate =
      unbilledCompletedSessions[unbilledCompletedSessions.length - 1]
        .sessionDate;

    let ratePerSession = 0;
    let totalBill = 0;

    const feesTypeName = patient?.FeesTypeId?.feesTypeName || "";

    if (feesTypeName === "PerMonth") {
      const totalDays = Number(
        patient.totalSessionDays || patient.noOfDays || 0,
      );
      if (!totalDays || totalDays <= 0) {
        throw new Error(
          "Patient total session days / no of days is required for PerMonth billing",
        );
      }

      ratePerSession = Number(patient.feeAmount || 0) / totalDays;
      totalBill = ratePerSession * totalSessionCount;
    } else {
      ratePerSession = Number(patient.feeAmount || 0);
      totalBill = ratePerSession * totalSessionCount;
    }

    const advPaid =
      (
        await Debit.aggregate([
          { $match: { patientId: patient._id } },
          { $group: { _id: null, total: { $sum: "$DebitAmount" } } },
        ])
      )[0]?.total || 0;

    const usedAdv =
      (
        await Bill.aggregate([
          { $match: { patientId: patient._id } },
          { $group: { _id: null, total: { $sum: "$DeductedFromAdvance" } } },
        ])
      )[0]?.total || 0;

    const deduct = Math.min(Math.max(advPaid - usedAdv, 0), totalBill);
    const netBilledAmount = totalBill - deduct;

    const billDate = new Date(lastDate);

    const newBill = await Bill.create({
      patientId: patient._id,
      physioId,
      paymentStatus: netBilledAmount <= 0 ? "Paid" : "Pending",
      paymentType: deduct > 0 && netBilledAmount > 0 ? "Partial Payment" : "",
      ReceivedAmount: deduct,
      TotalBilledAmount: Number(totalBill.toFixed(2)),
      DeductedFromAdvance: Number(deduct.toFixed(2)),
      NetBilledAmount: Number(netBilledAmount.toFixed(2)),
      startDate: firstDate,
      ToDate: lastDate,
      ratePerSession: Number(ratePerSession.toFixed(2)),
      TotalSessionCount: totalSessionCount,
      month: billDate.toLocaleString("default", { month: "long" }),
      year: billDate.getFullYear(),
      isComplete: netBilledAmount <= 0,
    });

    await Session.updateMany(
      { _id: { $in: sessionIds } },
      {
        $set: {
          isBilled: true,
          billId: newBill._id,
        },
      },
    );

    return {
      success: true,
      message: "Bill generated successfully for recovered patient",
      data: newBill,
    };
  } catch (error) {
    throw error;
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

    const amountReceivedNow = Number(receivedAmount);
    if (!Number.isFinite(amountReceivedNow) || amountReceivedNow <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid receivedAmount" });
    }

    const today = new Date();

    const netBilledAmount = Number(bill.NetBilledAmount || 0);

    // keep same precision as your bill data
    const newTotalReceived = Number(
      (Number(bill.ReceivedAmount || 0) + amountReceivedNow).toFixed(3),
    );

    let outstandingBalance = Number(
      (netBilledAmount - newTotalReceived).toFixed(3),
    );

    // handle tiny floating precision issues
    if (Math.abs(outstandingBalance) < 0.01) {
      outstandingBalance = 0;
    }

    bill.ReceivedAmount = newTotalReceived;

    if (outstandingBalance <= 0) {
      bill.paymentStatus = "Paid";
      bill.paymentType = "Full Payment";
      bill.isComplete = true;
      bill.ReceivedAmount = netBilledAmount; // match exactly

      await Credit.deleteMany({ BillId: bill._id });
    } else {
      bill.paymentStatus = "Partially Paid";
      bill.paymentType = "Partial Payment";
      bill.isComplete = false;

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
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// Get all bill
exports.getAllBill = async (req, res) => {
  try {
    const { month, year, patientId } = req.body;

    const query = {};

    // filter by bill month
    if (month && month !== "ALL") {
      query.month = String(month).trim();
    }

    // filter by bill year
    if (year && year !== "ALL") {
      query.year = Number(year);
    }

    // optional patient filter
    if (patientId && patientId !== "ALL") {
      query.patientId = patientId;
    }

    const bills = await Bill.find(query)
      .populate("physioId", "physioName")
      .populate("patientId")
      .sort({ createdAt: -1 });

    return res.status(200).json(bills);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Delete a bill
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
exports.updateSendStatus = async (req, res) => {
  try {
    const { billId } = req.body;

    const bill = await Bill.findByIdAndUpdate(
      billId,
      { isSend: true },
      { new: true },
    );

    res.status(200).json({
      message: "Bill marked as sent",
      data: bill,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.deleteAllBillsAndResetSessions = async (req, res) => {
  try {
    // 1) delete all bills
    const billResult = await Bill.deleteMany({});

    // 2) reset sessions billed flag (only completed sessions)
    const completedStatusId = new mongoose.Types.ObjectId(
      "691ec69eae0e10763c8f21e0",
    );

    const sessionResult = await Session.updateMany(
      { sessionStatusId: completedStatusId, isBilled: true },
      { $set: { isBilled: false } },
    );

    return res.status(200).json({
      message: "All bills deleted and sessions reset",
      billsDeleted: billResult.deletedCount,
      sessionsReset: sessionResult.modifiedCount,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
