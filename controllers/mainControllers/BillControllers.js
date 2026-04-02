const mongoose = require("mongoose");
const Bill = require("../../model/masterModels/Bill");
const Credit = require("../../model/masterModels/CreditPayment");
const Session = require("../../model/masterModels/Session");
const Debit = require("../../model/masterModels/DebitPayment");
const Patient = require("../../model/masterModels/Patient");
const Counter = require("../../model/masterModels/Counter");
const COMPLETED_STATUS_ID = "691ec69eae0e10763c8f21e0";

// helper: normalize fee type from patient
const getNormalizedFeeType = (patient) => {
  return String(
    patient?.FeesTypeId?.FeesTypeName ||
      patient?.FeesTypeId?.feesTypeName ||
      patient?.FeesTypeId?.name ||
      patient?.FeesTypeId?.feeTypeName ||
      "",
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
};

exports.createBill = async (req, res) => {
  try {
    const { patientId, month, year } = req.body;
    const counter = await Counter.findOneAndUpdate(
      { _id: "invoiceNo" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );
    if (!patientId || !month || !year) {
      return res.status(400).json({
        message: "patientId, month and year required",
      });
    }

    // const existingBill = await Bill.findOne({
    //   patientId,
    //   month: String(month).trim(),
    //   year: Number(year),
    // });

    // if (existingBill) {
    //   return res.status(400).json({
    //     message: `Bill already exists for ${month} ${year}`,
    //   });
    // }

    const monthIndex = new Date(`${month} 1, ${year}`).getMonth();

    if (isNaN(monthIndex)) {
      return res.status(400).json({ message: "Invalid month" });
    }

    const startDate = new Date(year, monthIndex, 1);
    const endDate = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

    const sessions = await Session.aggregate([
      {
        $match: {
          patientId: new mongoose.Types.ObjectId(patientId),
          sessionStatusId: new mongoose.Types.ObjectId(COMPLETED_STATUS_ID),
          sessionDate: { $gte: startDate, $lte: endDate },
          isBilled: false,
        },
      },
      {
        $group: {
          _id: "$patientId",
          count: { $sum: 1 },
          sessions: { $push: "$_id" },
          physioId: { $first: "$physioId" },
          firstDate: { $min: "$sessionDate" },
          lastDate: { $max: "$sessionDate" },
        },
      },
    ]);

    if (!sessions.length) {
      return res.status(400).json({
        message: "No completed sessions found",
      });
    }

    const item = sessions[0];

    const patient = await Patient.findById(patientId).populate("FeesTypeId");

    if (!patient || !item.physioId) {
      return res.status(400).json({
        message: "Invalid patient or physio",
      });
    }

    const feeAmount = Number(patient?.feeAmount || 0);
    const feeTypeName = getNormalizedFeeType(patient);

    const isPerMonth = feeTypeName === "permonth";
    const isPerSession = feeTypeName === "persession";

    let totalBill = 0;
    let ratePerSession = 0;

    if (isPerMonth) {
      totalBill = feeAmount;
      ratePerSession = 0;
    } else {
      ratePerSession = feeAmount;
      totalBill = feeAmount * item.count;
    }

    const advPaid =
      (
        await Debit.aggregate([
          { $match: { patientId: item._id } },
          { $group: { _id: null, total: { $sum: "$DebitAmount" } } },
        ])
      )[0]?.total || 0;

    const usedAdv =
      (
        await Bill.aggregate([
          { $match: { patientId: item._id } },
          { $group: { _id: null, total: { $sum: "$DeductedFromAdvance" } } },
        ])
      )[0]?.total || 0;

    const deduct = Math.min(Math.max(advPaid - usedAdv, 0), totalBill);
    const net = totalBill - deduct;

    const safeTotalBill = Number((totalBill || 0).toFixed(2));
    const safeDeduct = Number((deduct || 0).toFixed(2));
    const safeNet = Number((net || 0).toFixed(2));
    const invoiceNo = `INV-${String(counter.seq).padStart(6, "0")}`;

    const newBill = await Bill.create({
      patientId,
      invoiceNo,
      physioId: item.physioId,
      paymentStatus: safeNet <= 0 ? "Paid" : "Pending",
      paymentType:
        safeNet <= 0
          ? "Full Payment"
          : safeDeduct > 0
            ? "Partial Payment"
            : "Full Payment",
      ReceivedAmount: safeDeduct,
      TotalBilledAmount: safeTotalBill,
      DeductedFromAdvance: safeDeduct,
      NetBilledAmount: safeNet,
      startDate: item.firstDate,
      ToDate: item.lastDate,
      ratePerSession: Number(ratePerSession.toFixed(2)),
      totalAmount: safeTotalBill,
      TotalSessionCount: item.count,
      month: String(month).trim(),
      year: Number(year),
      isComplete: safeNet <= 0,
      feeType: isPerMonth ? "permonth" : "persession",
    });

    await Session.updateMany(
      { _id: { $in: item.sessions } },
      {
        $set: {
          isBilled: true,
          billId: newBill._id,
        },
      },
    );

    return res.status(200).json({
      message: "Manual bill generated successfully",
      data: newBill,
    });
  } catch (err) {
    console.error("Manual Billing Error:", err);
    return res.status(500).json({ message: err.message });
  }
};

exports.markBadDebt = async (req, res) => {
  try {
    const { billId } = req.body;

    if (!billId) {
      return res.status(400).json({
        success: false,
        message: "Bill ID is required",
      });
    }

    const bill = await Bill.findById(billId);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found",
      });
    }

    if (bill.isBadDebt) {
      return res.status(400).json({
        success: false,
        message: "Bill is already marked as bad debt",
      });
    }

    bill.isBadDebt = true;

    if (bill.ReceivedAmount > 0) {
      bill.paymentStatus = "Paid";
    } else {
      bill.paymentStatus = "Bad Debt";
    }

    bill.paymentType = "Bad Debt";
    bill.isComplete = bill.ReceivedAmount > 0;

    await bill.save();

    return res.status(200).json({
      success: true,
      message: "Bill marked as bad debt successfully",
      data: bill,
    });
  } catch (error) {
    console.error("Mark Bad Debt Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.generateBillForRecoveredPatient = async (patientId) => {
  try {
    const patient = await Patient.findById(patientId).populate("FeesTypeId");
    const counter = await Counter.findOneAndUpdate(
      { _id: "invoiceNo" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );
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

    const feeAmount = Number(patient?.feeAmount || 0);
    const feeTypeName = getNormalizedFeeType(patient);

    const isPerMonth = feeTypeName === "permonth";

    let ratePerSession = 0;
    let totalBill = 0;

    if (isPerMonth) {
      totalBill = feeAmount;
      ratePerSession = 0;
    } else {
      ratePerSession = feeAmount;
      totalBill = feeAmount * totalSessionCount;
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
    const invoiceNo = `INV-${String(counter.seq).padStart(6, "0")}`;

    const newBill = await Bill.create({
      patientId: patient._id,
      physioId,
      invoiceNo,
      paymentStatus: netBilledAmount <= 0 ? "Paid" : "Pending",
      paymentType:
        netBilledAmount <= 0
          ? "Full Payment"
          : deduct > 0
            ? "Partial Payment"
            : "Full Payment",
      ReceivedAmount: Number(deduct.toFixed(2)),
      TotalBilledAmount: Number(totalBill.toFixed(2)),
      DeductedFromAdvance: Number(deduct.toFixed(2)),
      NetBilledAmount: Number(netBilledAmount.toFixed(2)),
      startDate: firstDate,
      ToDate: lastDate,
      ratePerSession: Number(ratePerSession.toFixed(2)),
      totalAmount: Number(totalBill.toFixed(2)),
      TotalSessionCount: totalSessionCount,
      month: billDate.toLocaleString("default", { month: "long" }),
      year: billDate.getFullYear(),
      isComplete: netBilledAmount <= 0,
      feeType: isPerMonth ? "permonth" : "persession",
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
    const {
      receivedAmount = 0,
      discountAmount = 0,
      billId,
      notes,
      feedback,
    } = req.body;

    const bill = await Bill.findById(billId);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found",
      });
    }

    const receivedNow = Number(receivedAmount);
    const discountNow = Number(discountAmount);

    if (receivedNow < 0 || discountNow < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amounts",
      });
    }

    const net = Number(bill.NetBilledAmount || 0);
    const oldReceived = Number(bill.ReceivedAmount || 0);
    const oldDiscount = Number(bill.DiscountAmount || 0);

    const finalPayableBefore = Math.max(net - oldDiscount, 0);
    const pendingBefore = Math.max(finalPayableBefore - oldReceived, 0);

    if (discountNow > pendingBefore) {
      return res.status(400).json({
        success: false,
        message: "Discount cannot exceed pending amount",
      });
    }

    if (receivedNow > pendingBefore) {
      return res.status(400).json({
        success: false,
        message: "Payment cannot exceed pending amount",
      });
    }

    const updatedDiscount = Number((oldDiscount + discountNow).toFixed(2));
    const updatedReceived = Number((oldReceived + receivedNow).toFixed(2));

    const finalPayable = Math.max(net - updatedDiscount, 0);
    let outstanding = Number((finalPayable - updatedReceived).toFixed(2));

    if (Math.abs(outstanding) < 0.01) {
      outstanding = 0;
    }

    bill.DiscountAmount = updatedDiscount;
    bill.ReceivedAmount = updatedReceived;

    if (bill.isBadDebt) {
      bill.paymentStatus = updatedReceived > 0 ? "Paid" : "Bad Debt";
      bill.paymentType = "Bad Debt";
      bill.isComplete = updatedReceived > 0;
    } else if (outstanding === 0) {
      bill.paymentStatus = "Paid";
      bill.paymentType = "Full Payment";
      bill.isComplete = true;
    } else if (updatedReceived > 0) {
      bill.paymentStatus = "Partially Paid";
      bill.paymentType = "Partial Payment";
      bill.isComplete = false;
    } else if (updatedDiscount > 0) {
      bill.paymentStatus = "Pending";
      bill.paymentType = "Discount";
      bill.isComplete = false;
    } else {
      bill.paymentStatus = "Pending";
      bill.paymentType = "Pending";
      bill.isComplete = false;
    }

    const today = new Date();

    if (bill.isBadDebt) {
      await Credit.deleteMany({ BillId: bill._id });
    } else if (outstanding > 0) {
      const existingCredit = await Credit.findOne({ BillId: bill._id });

      if (existingCredit) {
        existingCredit.CreditAmount = outstanding;
        existingCredit.CreditDate = today;
        existingCredit.Creditfeedback =
          feedback || existingCredit.Creditfeedback || "";
        existingCredit.Creditnotes = notes || existingCredit.Creditnotes || "";

        await existingCredit.save();
      } else {
        await Credit.create({
          BillId: bill._id,
          patientId: bill.patientId,
          CreditAmount: outstanding,
          CreditDate: today,
          CreditMonth: today.getMonth() + 1,
          CreditYear: today.getFullYear(),
          Creditdescription: `Outstanding balance from Bill ${bill.month} - ${bill.year}`,
          Creditfeedback: feedback || "",
          Creditnotes:
            notes ||
            (discountNow > 0
              ? "System generated after discount"
              : "System generated from partial payment"),
        });
      }
    } else {
      await Credit.deleteMany({ BillId: bill._id });
    }

    await bill.save();

    return res.status(200).json({
      success: true,
      message: "Payment recorded successfully",
      data: bill,
      outstandingBalance: outstanding,
    });
  } catch (error) {
    console.error("receivePayment error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getAllBill = async (req, res) => {
  try {
    const { month, year, patientId } = req.body;

    const monthNames = [
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

    let filter = {};

    if (patientId && patientId !== "ALL") {
      filter.patientId = patientId;
    }

    if (month && year) {
      const monthIndex = monthNames.findIndex(
        (m) => m.toLowerCase() === String(month).toLowerCase(),
      );

      if (monthIndex !== -1) {
        const startDate = new Date(Number(year), monthIndex, 1, 0, 0, 0, 0);
        const endDate = new Date(Number(year), monthIndex + 1, 1, 0, 0, 0, 0);

        filter.createdAt = {
          $gte: startDate,
          $lt: endDate,
        };
      }
    }

    const bills = await Bill.find(filter)
      .populate("patientId")
      .populate("physioId")
      .sort({ createdAt: -1 });

    return res.status(200).json(bills);
  } catch (error) {
    console.error("getAllBill error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch bills",
    });
  }
};

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
    const billResult = await Bill.deleteMany({});

    const completedStatusId = new mongoose.Types.ObjectId(COMPLETED_STATUS_ID);

    const sessionResult = await Session.updateMany(
      { sessionStatusId: completedStatusId, isBilled: true },
      {
        $set: {
          isBilled: false,
          billId: null,
        },
      },
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

exports.revertBillingStatusGlobal = async (req, res) => {
  try {
    const { monthName, year } = req.body;
    // Example req.body: { "monthName": "March", "year": 2026 }

    if (!monthName || !year) {
      return res
        .status(400)
        .json({ message: "Please provide monthName (e.g. 'March') and year." });
    }

    const targetFeesTypeId = new mongoose.Types.ObjectId(
      "691af5dc43be7d5e28619825",
    );

    // 1. Calculate Date Range for the provided Month/Year
    const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth(); // Converts "March" to 2
    const startDate = new Date(year, monthIndex, 1, 0, 0, 0, 0);
    const endDate = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

    console.log(`[Revert] Targeting FeesType: ${targetFeesTypeId}`);
    console.log(
      `[Revert] Range: ${startDate.toDateString()} to ${endDate.toDateString()}`,
    );

    // 2. Get all Patient IDs for this specific FeesType
    const patients = await Patient.find({
      FeesTypeId: targetFeesTypeId,
    }).select("_id");
    const patientIds = patients.map((p) => p._id);

    if (patientIds.length === 0) {
      return res.status(404).json({
        message: `No patients found for FeesType 691af5dc43be7d5e28619825`,
      });
    }

    // 3. Update the Sessions
    // We look for sessions within the date range that are currently marked as billed
    const result = await Session.updateMany(
      {
        patientId: { $in: patientIds },
        sessionDate: { $gte: startDate, $lte: endDate },
        isBilled: true,
      },
      {
        $set: {
          isBilled: false,
          billId: null, // Clear the reference to the incorrect bill
        },
      },
    );

    return res.status(200).json({
      success: true,
      message: `Successfully reverted sessions for ${monthName} ${year}`,
      affectedPatients: patientIds.length,
      sessionsUpdated: result.modifiedCount,
    });
  } catch (err) {
    console.error("Global Revert Error:", err);
    return res.status(500).json({
      success: false,
      error: "Ensure month name is spelled correctly (e.g., 'March').",
      details: err.message,
    });
  }
};

exports.syncCorrectMarchBillsFixed = async (req, res) => {
  try {
    const { month, year } = req.body;
    const completedStatusId = new mongoose.Types.ObjectId(
      "691ec69eae0e10763c8f21e0",
    );

    // 1. Calculate the Date Range for the month
    const monthIndex = new Date(`${month} 1, ${year}`).getMonth();
    const startDateRange = new Date(year, monthIndex, 1, 0, 0, 0, 0);
    const endDateRange = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

    console.log(`[Sync] Starting deep sync for ${month} ${year}...`);

    // STEP 1: SAFETY RESET
    // Find any session in this month that is NOT 'Completed' but is currently marked 'isBilled: true'
    // and reset it to false.
    const safetyReset = await Session.updateMany(
      {
        sessionDate: { $gte: startDateRange, $lte: endDateRange },
        sessionStatusId: { $ne: completedStatusId },
        isBilled: true,
      },
      {
        $set: { isBilled: false, billId: null },
      },
    );

    // STEP 2: GET VALID BILLS
    const validBills = await Bill.find({ month, year })
      .populate("patientId", "patientName")
      .lean();

    if (validBills.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No valid bills found. Safety reset completed.",
        nonCompletedReset: safetyReset.modifiedCount,
      });
    }

    let totalSessionsRestored = 0;
    const processDetails = [];

    // STEP 3: RE-LINK ONLY COMPLETED SESSIONS
    for (const bill of validBills) {
      const result = await Session.updateMany(
        {
          patientId: bill.patientId?._id,
          sessionDate: { $gte: bill.startDate, $lte: bill.ToDate },
          sessionStatusId: completedStatusId, // Only Completed
        },
        {
          $set: {
            isBilled: true,
            billId: bill._id,
          },
        },
      );

      processDetails.push({
        patientName: bill.patientId?.patientName || "Unknown Patient",
        invoiceNo: bill.invoiceNo,
        sessionsFixed: result.modifiedCount,
        billPeriod: `${bill.startDate.toISOString().split("T")[0]} to ${bill.ToDate.toISOString().split("T")[0]}`,
      });

      totalSessionsRestored += result.modifiedCount;
    }

    return res.status(200).json({
      success: true,
      summary: {
        totalBillsProcessed: validBills.length,
        totalCompletedSessionsRestored: totalSessionsRestored,
        nonCompletedSessionsCleaned: safetyReset.modifiedCount,
      },
      details: processDetails,
    });
  } catch (err) {
    console.error("Sync Fixed Error:", err);
    return res.status(500).json({
      success: false,
      error: "Detailed Sync failed",
      message: err.message,
    });
  }
};

exports.getSessionBillingAudit = async (req, res) => {
  try {
    const { month, year } = req.body; // e.g., "March", 2026

    // 1. Define the specific Month/Year boundary
    // JavaScript months are 0-indexed (March is 2)
    const monthIndex = new Date(`${month} 1, ${year}`).getMonth();
    const startDate = new Date(year, monthIndex, 1, 0, 0, 0, 0);
    const endDate = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

    const completedStatusId = new mongoose.Types.ObjectId(
      "691ec69eae0e10763c8f21e0",
    );

    // 2. Aggregate counts
    const auditData = await Session.aggregate([
      {
        $match: {
          sessionDate: { $gte: startDate, $lte: endDate },
          sessionStatusId: completedStatusId,
        },
      },
      {
        $group: {
          _id: null,
          totalCompleted: { $sum: 1 },
          billedCount: {
            $sum: { $cond: [{ $eq: ["$isBilled", true] }, 1, 0] },
          },
          unbilledCount: {
            $sum: { $cond: [{ $eq: ["$isBilled", false] }, 1, 0] },
          },
        },
      },
    ]);

    // 3. Handle empty results
    const result = auditData[0] || {
      totalCompleted: 0,
      billedCount: 0,
      unbilledCount: 0,
    };

    return res.status(200).json({
      success: true,
      queryRange: {
        from: startDate.toDateString(),
        to: endDate.toDateString(),
      },
      data: {
        totalCompletedSessions: result.totalCompleted,
        alreadyBilled: result.billedCount,
        pendingToBeBilled: result.unbilledCount,
        status:
          result.unbilledCount > 0
            ? "Pending Actions Required"
            : "All Sessions Billed",
      },
    });
  } catch (err) {
    console.error("Audit Error:", err);
    return res.status(500).json({
      success: false,
      message: "Could not retrieve session audit.",
      error: err.message,
    });
  }
};
