const mongoose = require("mongoose");
const Bill = require("../../model/masterModels/Bill");
const Credit = require("../../model/masterModels/CreditPayment");
const Session = require("../../model/masterModels/Session");
const Debit = require("../../model/masterModels/DebitPayment");
const Patient = require("../../model/masterModels/Patient");
const Counter = require("../../model/masterModels/Counter");

const COMPLETED_STATUS_ID = "691ec69eae0e10763c8f21e0";

// ✅ your master fee type ids
const PER_MONTH_ID = "691af5c343be7d5e2861981f";
const PER_SESSION_ID = "691af5dc43be7d5e28619825";

// helper
const round2 = (value) => Number((Number(value) || 0).toFixed(2));

// ✅ per month rate calculation
const getPerMonthRatePerSession = (feeAmount) => {
  return round2(Number(feeAmount || 0) / 26);
};

// helper: fallback name check only if id is missing
const getNormalizedFeeTypeName = (patient) => {
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

// helper: single source of truth
const getBillingTypeDetails = (patient) => {
  const feeTypeId = String(
    patient?.FeesTypeId?._id || patient?.FeesTypeId || "",
  );
  const normalizedName = getNormalizedFeeTypeName(patient);

  const isPerMonth =
    feeTypeId === PER_MONTH_ID ||
    normalizedName === "permonth" ||
    normalizedName === "monthly" ||
    normalizedName === "month";

  const isPerSession =
    feeTypeId === PER_SESSION_ID ||
    normalizedName === "persession" ||
    normalizedName === "session";

  if (isPerMonth) {
    return { feeType: "permonth", isPerMonth: true, isPerSession: false };
  }

  return { feeType: "persession", isPerMonth: false, isPerSession: true };
};

exports.createBill = async (req, res) => {
  try {
    const { patientId, month, year } = req.body;

    if (!patientId || !month || !year) {
      return res.status(400).json({
        message: "patientId, month and year required",
      });
    }

    const counter = await Counter.findOneAndUpdate(
      { _id: "invoiceNo" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );

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
    const { feeType, isPerMonth } = getBillingTypeDetails(patient);

    let totalBill = 0;
    let ratePerSession = 0;

    if (isPerMonth) {
      totalBill = feeAmount;
      ratePerSession = getPerMonthRatePerSession(feeAmount);
    } else {
      ratePerSession = round2(feeAmount);
      totalBill = round2(feeAmount * Number(item.count || 0));
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

    const safeTotalBill = round2(totalBill);
    const safeDeduct = round2(deduct);
    const safeNet = round2(net);
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
            : "Pending",
      ReceivedAmount: safeDeduct,
      TotalBilledAmount: safeTotalBill,
      DeductedFromAdvance: safeDeduct,
      NetBilledAmount: safeNet,
      startDate: item.firstDate,
      ToDate: item.lastDate,
      ratePerSession: round2(ratePerSession),
      totalAmount: safeTotalBill,
      TotalSessionCount: Number(item.count || 0),
      month: String(month).trim(),
      year: Number(year),
      isComplete: safeNet <= 0,
      feeType,
      isBadDebt: false,
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

    if (Number(bill.ReceivedAmount || 0) > 0) {
      bill.paymentStatus = "Paid";
    } else {
      bill.paymentStatus = "Bad Debt";
    }

    bill.paymentType = "Bad Debt";
    bill.isComplete = Number(bill.ReceivedAmount || 0) > 0;

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

    if (!patient) {
      throw new Error("Patient not found");
    }

    const counter = await Counter.findOneAndUpdate(
      { _id: "invoiceNo" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );

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
    const { feeType, isPerMonth } = getBillingTypeDetails(patient);

    let ratePerSession = 0;
    let totalBill = 0;

    if (isPerMonth) {
      totalBill = feeAmount;
      ratePerSession = getPerMonthRatePerSession(feeAmount);
    } else {
      ratePerSession = round2(feeAmount);
      totalBill = round2(feeAmount * totalSessionCount);
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
            : "Pending",
      ReceivedAmount: round2(deduct),
      TotalBilledAmount: round2(totalBill),
      DeductedFromAdvance: round2(deduct),
      NetBilledAmount: round2(netBilledAmount),
      startDate: firstDate,
      ToDate: lastDate,
      ratePerSession: round2(ratePerSession),
      totalAmount: round2(totalBill),
      TotalSessionCount: totalSessionCount,
      month: billDate.toLocaleString("default", { month: "long" }),
      year: billDate.getFullYear(),
      isComplete: netBilledAmount <= 0,
      feeType,
      isBadDebt: false,
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

    const updatedDiscount = round2(oldDiscount + discountNow);
    const updatedReceived = round2(oldReceived + receivedNow);

    const finalPayable = Math.max(net - updatedDiscount, 0);
    let outstanding = round2(finalPayable - updatedReceived);

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
            (discountAmount > 0
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
    const query = {};

    if (month && month !== "ALL") {
      query.month = String(month).trim();
    }

    if (year && year !== "ALL") {
      query.year = Number(year);
    }

    if (patientId && patientId !== "ALL") {
      query.patientId = patientId;
    }

    const bills = await Bill.find(query)
      .populate("physioId", "physioName")
      .populate({
        path: "patientId",
        populate: {
          path: "FeesTypeId",
        },
      })
      .sort({ createdAt: -1 });

    return res.status(200).json(bills);
  } catch (error) {
    return res.status(500).json({ message: error.message });
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

    await Session.updateMany(
      { billId: bill._id },
      {
        $set: {
          isBilled: false,
          billId: null,
        },
      },
    );

    await Credit.deleteMany({ BillId: bill._id });

    return res.status(200).json({ message: "Bill deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
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

    return res.status(200).json({
      message: "Bill marked as sent",
      data: bill,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.deleteAllBillsAndResetSessions = async (req, res) => {
  try {
    const allBills = await Bill.find({}, { _id: 1 });
    const allBillIds = allBills.map((b) => b._id);

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

    if (allBillIds.length > 0) {
      await Credit.deleteMany({ BillId: { $in: allBillIds } });
    }

    return res.status(200).json({
      message: "All bills deleted and sessions reset",
      billsDeleted: billResult.deletedCount,
      sessionsReset: sessionResult.modifiedCount,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// exports.fixPerMonthBills = async (req, res) => {
//   try {
//     const { billId, patientId } = req.body;

//     const query = {};

//     if (billId) {
//       if (!mongoose.Types.ObjectId.isValid(billId)) {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid billId",
//         });
//       }
//       query._id = billId;
//     }

//     if (patientId) {
//       if (!mongoose.Types.ObjectId.isValid(patientId)) {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid patientId",
//         });
//       }
//       query.patientId = patientId;
//     }

//     const bills = await Bill.find(query).populate({
//       path: "patientId",
//       populate: {
//         path: "FeesTypeId",
//       },
//     });

//     if (!bills.length) {
//       return res.status(404).json({
//         success: false,
//         message: "No bills found",
//       });
//     }

//     const updatedBills = [];
//     const skippedBills = [];

//     for (const bill of bills) {
//       const patient = bill.patientId;

//       if (!patient) {
//         skippedBills.push({
//           billId: bill._id,
//           reason: "Patient not found",
//         });
//         continue;
//       }

//       const feeTypeId = String(
//         patient?.FeesTypeId?._id || patient?.FeesTypeId || "",
//       );

//       // only monthly patients
//       if (feeTypeId !== PER_MONTH_ID) {
//         skippedBills.push({
//           billId: bill._id,
//           patientName: patient?.patientName || "",
//           reason: "Patient is not permonth",
//         });
//         continue;
//       }

//       const feeAmount = round2(patient?.feeAmount || 0);
//       const deductedFromAdvance = round2(bill?.DeductedFromAdvance || 0);
//       const receivedAmount = round2(bill?.ReceivedAmount || 0);
//       const discountAmount = round2(bill?.DiscountAmount || 0);

//       const totalBilledAmount = feeAmount;
//       const ratePerSession = getPerMonthRatePerSession(feeAmount);
//       const netBilledAmount = Math.max(
//         totalBilledAmount - deductedFromAdvance,
//         0,
//       );
//       const finalPayable = Math.max(netBilledAmount - discountAmount, 0);
//       const pendingAmount = Math.max(finalPayable - receivedAmount, 0);

//       let paymentStatus = "Pending";
//       let paymentType = "Pending";
//       let isComplete = false;

//       if (pendingAmount === 0) {
//         paymentStatus = "Paid";
//         paymentType = "Full Payment";
//         isComplete = true;
//       } else if (receivedAmount > 0) {
//         paymentStatus = "Partially Paid";
//         paymentType = "Partial Payment";
//         isComplete = false;
//       } else if (discountAmount > 0) {
//         paymentStatus = "Pending";
//         paymentType = "Discount";
//         isComplete = false;
//       }

//       await Bill.updateOne(
//         { _id: bill._id },
//         {
//           $set: {
//             feeType: "permonth",
//             ratePerSession: round2(ratePerSession),
//             TotalBilledAmount: round2(totalBilledAmount),
//             totalAmount: round2(totalBilledAmount),
//             NetBilledAmount: round2(netBilledAmount),
//             paymentStatus,
//             paymentType,
//             isComplete,
//           },
//         },
//       );

//       updatedBills.push({
//         billId: bill._id,
//         patientName: patient?.patientName || "",
//         feeType: "permonth",
//         ratePerSession: round2(ratePerSession),
//         TotalBilledAmount: round2(totalBilledAmount),
//         NetBilledAmount: round2(netBilledAmount),
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       message: "PerMonth bills fixed successfully",
//       updatedCount: updatedBills.length,
//       skippedCount: skippedBills.length,
//       updatedBills,
//       skippedBills,
//     });
//   } catch (error) {
//     console.error("fixPerMonthBills error:", error);
//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };
