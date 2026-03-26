const cron = require("node-cron");
const mongoose = require("mongoose");
const Session = require("../../model/masterModels/Session");
const Review = require("../../model/masterModels/Review");
const ReviewType = require("../../model/masterModels/ReviewType");
const Patient = require("../../model/masterModels/Patient");
const ReviewStatus = require("../../model/masterModels/ReviewStatus");
const Notification = require("../../model/masterModels/Notification");
const SessionStatus = require("../../model/masterModels/SessionStatus");
const PetrolAllowance = require("../../model/masterModels/PetrolAllowance");
const Physio = require("../../model/masterModels/Physio");
const RoleBased = require("../../model/masterModels/RBAC");
const Counter = require("../../model/masterModels/Counter");
const LeaveModel = require("../../model/masterModels/Leave");
const Payroll = require("../../model/masterModels/Payroll");
const Bill = require("../../model/masterModels/Bill");
const Debit = require("../../model/masterModels/DebitPayment");

// --- HELPERS (Preserved exactly) ---
const getISTDateRange = () => {
  const now = new Date();
  const offset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(
    now.getTime() + now.getTimezoneOffset() * 60000 + offset,
  );
  const start = new Date(
    Date.UTC(istNow.getFullYear(), istNow.getMonth(), istNow.getDate()),
  );
  const end = new Date(
    Date.UTC(
      istNow.getFullYear(),
      istNow.getMonth(),
      istNow.getDate(),
      23,
      59,
      59,
      999,
    ),
  );
  return { start, end };
};

async function broadcastNotification(admins, message, type, meta, io) {
  for (const admin of admins) {
    try {
      await Notification.create({
        toEmployeeId: admin._id,
        message,
        type,
        status: "unseen",
        meta,
      });
      if (io) io.to(admin._id.toString()).emit("receiveNotification", message);
    } catch (err) {
      console.error(`❌ Notification Error:`, err.message);
    }
  }
}

// --- CORE PROCESS FUNCTIONS ---

exports.processDailySessionGeneration = async () => {
  try {
    const { start, end } = getISTDateRange();
    const completedStatusId = "691ec69eae0e10763c8f21e0";
    const pendingStatusId = "691ecb36b87c5c57dead47a7";
    const activePatients = await Patient.find({
      isRecovered: false,
      sessionStartDate: { $lte: end },
    }).sort({ visitOrder: 1 });
    for (const patient of activePatients) {
      const exists = await Session.findOne({
        patientId: patient._id,
        sessionDate: { $gte: start, $lte: end },
      });
      if (exists) continue;

      let finalPhysioId = patient.physioId;
      let finalSessionTime = patient.sessionTime;
      const leaveRecord = await LeaveModel.findOne({
        physioId: patient.physioId,
        LeaveDate: { $gte: start, $lte: end },
        isActive: true,
      });
      if (leaveRecord?.SessionGenerateForLeave) {
        const reassignmentData = leaveRecord.SessionGenerateForLeave.find(
          (item) => item.patientId?.toString() === patient._id.toString(),
        );
        if (reassignmentData?.Re_Assign) {
          finalPhysioId = reassignmentData.Re_Assign;
          finalSessionTime =
            reassignmentData.sessionTime || patient.sessionTime;
        } else {
          console.log(
            `Skipping session for patient ${patient._id} because physio is on leave and no reassignment found`,
          );
          continue;
        }
      }

      const counter = await Counter.findOneAndUpdate(
        { _id: "sessionCode" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
      );
      const completedCount = await Session.countDocuments({
        patientId: patient._id,
        cycleId: patient.activeCycleId,
        sessionStatusId: completedStatusId,
      });
      const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
      const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      const monthlyCompletedCount = await Session.countDocuments({
        patientId: patient._id,
        cycleId: patient.activeCycleId,
        sessionStatusId: completedStatusId,
        sessionDate: { $gte: monthStart, $lt: monthEnd },
      });
      if (!patient.activeCycleId) {
        console.log(
          `❌ Skipping patient ${patient._id} - No activeCycleId found`,
        );
        continue;
      }
      await Session.create({
        sessionCode: `SESS-${String(counter.seq).padStart(6, "0")}`,
        patientId: patient._id,

        cycleId: patient.activeCycleId,

        physioId: finalPhysioId?._id || finalPhysioId,
        sessionDate: start,
        sessionDay: start.toLocaleDateString("en-IN", { weekday: "long" }),
        sessionTime: finalSessionTime,
        targetArea: patient.targetedArea,
        sessionStatusId: pendingStatusId,
        sessionCount: completedCount + 1,
        monthlySessionCount: monthlyCompletedCount + 1,
        modeOfExercise: "General",
      });
    }
    console.log("✅ 5 AM: Sessions Generated.");
  } catch (err) {
    console.error("5AM Error:", err);
  }
};

exports.processScheduledReviewGeneration = async () => {
  try {
    const [typeDefault, statusPending] = await Promise.all([
      ReviewType.findOne({ reviewTypeName: "General" }),
      ReviewStatus.findOne({ reviewStatusName: "Pending" }),
    ]);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const todayStr = new Date(Date.now() + istOffset)
      .toISOString()
      .split("T")[0];
    const tomorrowStr = new Date(Date.now() + istOffset + 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const activePatients = await Patient.find({ isRecovered: false });
    for (const patient of activePatients) {
      if (!patient.reviewFrequency || !patient.sessionStartDate) continue;
      const lastReview = await Review.findOne({ patientId: patient._id }).sort({
        reviewDate: -1,
      });
      let baseDateStr = new Date(
        lastReview ? lastReview.reviewDate : patient.sessionStartDate,
      )
        .toISOString()
        .split("T")[0];
      let calcDate = new Date(baseDateStr + "T00:00:00.000Z");
      calcDate.setUTCDate(calcDate.getUTCDate() + patient.reviewFrequency);
      if (calcDate.getUTCDay() === 0)
        calcDate.setUTCDate(calcDate.getUTCDate() + 1);

      const nextDueStr = calcDate.toISOString().split("T")[0];
      if (nextDueStr === todayStr || nextDueStr === tomorrowStr) {
        const finalISODate = nextDueStr + "T00:00:00.000Z";
        const exists = await Review.findOne({
          patientId: patient._id,
          reviewDate: new Date(finalISODate),
        });
        if (!exists)
          await Review.create({
            patientId: patient._id,
            physioId: patient.physioId,
            reviewDate: finalISODate,
            reviewStatusId: statusPending._id,
            reviewTypeId: typeDefault._id,
          });
      }
    }
  } catch (err) {
    console.error("Review Error:", err);
  }
};

exports.processReturnJourneyAllowance = async () => {
  try {
    const completedStatus = await SessionStatus.findOne({
      sessionStatusName: "Completed",
    });
    if (!completedStatus) return;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const sessions = await Session.find({
      sessionDate: { $gte: start, $lte: end },
      sessionStatusId: completedStatus._id,
    }).populate("patientId");

    const physioReturnKms = {};
    sessions.forEach((s) => {
      if (s.patientId?.KmsfLPatienttoHub > 0) {
        const pid = s.physioId.toString();
        physioReturnKms[pid] =
          (physioReturnKms[pid] || 0) + s.patientId.KmsfLPatienttoHub;
      }
    });

    for (const [physioId, kms] of Object.entries(physioReturnKms)) {
      await PetrolAllowance.findOneAndUpdate(
        { physioId, date: { $gte: start, $lte: end } },
        {
          $set: { completedKms: kms, finalDailyKms: kms, status: "Pending" },
          $setOnInsert: { physioId, date: new Date() },
        },
        { upsert: true },
      );
    }
    console.log("✅ 7:30 PM: Petrol Updated.");
  } catch (err) {
    console.error("Petrol Error:", err);
  }
};

exports.processSessionPendingCheck = async (io) => {
  try {
    const { start, end } = getISTDateRange();
    const compId = new mongoose.Types.ObjectId("691ec69eae0e10763c8f21e0");
    const cancId = new mongoose.Types.ObjectId("692585f037162b40bd30a1ef");
    const revCompId = new mongoose.Types.ObjectId("694f85db081ee43cab2d4c8f");

    const roles = await RoleBased.find({
      RoleName: { $in: ["Admin", "SuperAdmin", "HOD"] },
    });
    const admins = await Physio.find({
      roleId: { $in: roles.map((r) => r._id) },
      isActive: true,
    });

    const pendSessions = await Session.find({
      sessionDate: { $gte: start, $lte: end },
      sessionStatusId: { $nin: [compId, cancId] },
    }).populate("patientId physioId");
    const pendReviews = await Review.find({
      reviewDate: { $gte: start, $lte: end },
      reviewStatusId: { $ne: revCompId },
    }).populate("patientId physioId reviewTypeId");
    for (const s of pendSessions) {
      await broadcastNotification(
        admins,
        `Physio - ${s.physioId?.physioName} pending session for - ${s.patientId?.patientName}`,
        "Session-Update",
        { SessionId: s._id },
        io,
      );
    }

    for (const r of pendReviews) {
      console.log(
        "Sending review notification for:",
        r._id,
        r.patientId?.patientName,
      );

      await broadcastNotification(
        admins,
        `(${r.physioId?.physioName}) ${r.reviewTypeId?.reviewTypeName || "General"} review for - ${r.patientId?.patientName} is Pending`,
        "Pending-Review",
        { ReviewId: r._id },
        io,
      );
    }
  } catch (err) {
    console.error("8 PM Error:", err);
  }
};

exports.processMonthlyBilling = async () => {
  try {
    const today = new Date();

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const month = today.toLocaleString("default", { month: "long" });
    const year = today.getFullYear();

    // helper for invoice no
    const getNextInvoiceNo = async () => {
      const lastBill = await Bill.findOne({ invoiceNo: { $exists: true } })
        .sort({ invoiceNo: -1 })
        .select("invoiceNo");

      let invoiceNo = 100001;

      if (lastBill?.invoiceNo) {
        invoiceNo = Number(lastBill.invoiceNo) + 1;
      }

      return invoiceNo;
    };

    // helper for fee type
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

    // helper for advance usage
    const applyAdvanceAndResetDebit = async (patientId, deductAmount) => {
      if (!deductAmount || deductAmount <= 0) return;

      let remainingDeduct = Number(deductAmount || 0);

      const debitEntries = await Debit.find({
        patientId,
        DebitAmount: { $gt: 0 },
      }).sort({ createdAt: 1 });

      for (const debit of debitEntries) {
        if (remainingDeduct <= 0) break;

        const currentDebitAmount = Number(debit.DebitAmount || 0);

        if (currentDebitAmount <= remainingDeduct) {
          remainingDeduct -= currentDebitAmount;
          debit.DebitAmount = 0;
        } else {
          debit.DebitAmount = Number(
            (currentDebitAmount - remainingDeduct).toFixed(2),
          );
          remainingDeduct = 0;
        }

        await debit.save();
      }
    };

    // get all patients who have unbilled completed sessions
    const patientsWithUnbilledSessions = await Session.aggregate([
      {
        $match: {
          sessionStatusId: new mongoose.Types.ObjectId(
            "691ec69eae0e10763c8f21e0",
          ),
          isBilled: false,
        },
      },
      {
        $group: {
          _id: "$patientId",
        },
      },
    ]);

    for (const row of patientsWithUnbilledSessions) {
      const patientId = row._id;

      const patient = await Patient.findById(patientId).populate("FeesTypeId");

      if (!patient) continue;

      const feeTypeName = getNormalizedFeeType(patient);
      const isPerMonth = feeTypeName === "permonth";
      const isPerSession = feeTypeName === "persession";

      // =========================
      // 1) PER MONTH BILLING
      // =========================
      if (isPerMonth) {
        const monthlySessions = await Session.find({
          patientId,
          sessionStatusId: new mongoose.Types.ObjectId(
            "691ec69eae0e10763c8f21e0",
          ),
          sessionDate: { $gte: startOfMonth, $lte: endOfMonth },
          isBilled: false,
        }).sort({ sessionDate: 1 });

        if (!monthlySessions.length) {
          continue;
        }

        const existingBill = await Bill.findOne({
          patientId,
          month,
          year,
          feeType: "permonth",
        });

        if (existingBill) {
          console.log("Monthly bill already exists for:", patient.patientName);
          continue;
        }

        const physioId =
          monthlySessions[0]?.physioId || patient?.physioId || null;

        if (!physioId) continue;

        const feeAmount = Number(patient?.feeAmount || 0);
        const totalBill = feeAmount;

        const advPaidAgg = await Debit.aggregate([
          { $match: { patientId } },
          { $group: { _id: null, total: { $sum: "$DebitAmount" } } },
        ]);
        const advPaid = advPaidAgg[0]?.total || 0;

        const usedAdvAgg = await Bill.aggregate([
          { $match: { patientId } },
          { $group: { _id: null, total: { $sum: "$DeductedFromAdvance" } } },
        ]);
        const usedAdv = usedAdvAgg[0]?.total || 0;

        const availableAdvance = Math.max(advPaid - usedAdv, 0);
        const deduct = Math.min(availableAdvance, totalBill);
        const netBilledAmount = totalBill - deduct;

        const invoiceNo = await getNextInvoiceNo();

        const newBill = await Bill.create({
          patientId,
          invoiceNo,
          physioId,
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
          startDate: monthlySessions[0].sessionDate,
          ToDate: monthlySessions[monthlySessions.length - 1].sessionDate,
          ratePerSession: 0,
          totalAmount: Number(totalBill.toFixed(2)),
          TotalSessionCount: monthlySessions.length,
          month,
          year,
          isComplete: netBilledAmount <= 0,
          feeType: "permonth",
        });

        await Session.updateMany(
          { _id: { $in: monthlySessions.map((s) => s._id) } },
          {
            $set: {
              isBilled: true,
              billId: newBill._id,
            },
          },
        );

        await applyAdvanceAndResetDebit(patientId, deduct);

        console.log(
          `PerMonth bill created for ${patient.patientName} | Invoice: ${invoiceNo}`,
        );

        continue;
      }

      // =========================
      // 2) PER SESSION BILLING
      // =========================
      if (isPerSession) {
        const unbilledSessions = await Session.find({
          patientId,
          sessionStatusId: new mongoose.Types.ObjectId(
            "691ec69eae0e10763c8f21e0",
          ),
          isBilled: false,
        }).sort({ sessionDate: 1 });

        if (unbilledSessions.length < 26) {
          console.log(
            `Skipping ${patient.patientName} - only ${unbilledSessions.length} sessions`,
          );
          continue;
        }

        // take only first 26 sessions for one bill
        const sessionsToBill = unbilledSessions.slice(0, 26);

        const physioId =
          sessionsToBill[0]?.physioId || patient?.physioId || null;
        if (!physioId) continue;

        const billMonth = new Date(
          sessionsToBill[sessionsToBill.length - 1].sessionDate,
        ).toLocaleString("default", { month: "long" });
        const billYear = new Date(
          sessionsToBill[sessionsToBill.length - 1].sessionDate,
        ).getFullYear();

        const existingBill = await Bill.findOne({
          patientId,
          month: billMonth,
          year: billYear,
          feeType: "persession",
          startDate: sessionsToBill[0].sessionDate,
          ToDate: sessionsToBill[sessionsToBill.length - 1].sessionDate,
        });

        if (existingBill) {
          console.log(
            "PerSession bill already exists for:",
            patient.patientName,
          );
          continue;
        }

        const feeAmount = Number(patient?.feeAmount || 0);
        const totalBill = feeAmount * 26;

        const advPaidAgg = await Debit.aggregate([
          { $match: { patientId } },
          { $group: { _id: null, total: { $sum: "$DebitAmount" } } },
        ]);
        const advPaid = advPaidAgg[0]?.total || 0;

        const usedAdvAgg = await Bill.aggregate([
          { $match: { patientId } },
          { $group: { _id: null, total: { $sum: "$DeductedFromAdvance" } } },
        ]);
        const usedAdv = usedAdvAgg[0]?.total || 0;

        const availableAdvance = Math.max(advPaid - usedAdv, 0);
        const deduct = Math.min(availableAdvance, totalBill);
        const netBilledAmount = totalBill - deduct;

        const invoiceNo = await getNextInvoiceNo();

        const newBill = await Bill.create({
          patientId,
          invoiceNo,
          physioId,
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
          startDate: sessionsToBill[0].sessionDate,
          ToDate: sessionsToBill[sessionsToBill.length - 1].sessionDate,
          ratePerSession: Number(feeAmount.toFixed(2)),
          totalAmount: Number(totalBill.toFixed(2)),
          TotalSessionCount: 26,
          month: billMonth,
          year: billYear,
          isComplete: netBilledAmount <= 0,
          feeType: "persession",
        });

        await Session.updateMany(
          { _id: { $in: sessionsToBill.map((s) => s._id) } },
          {
            $set: {
              isBilled: true,
              billId: newBill._id,
            },
          },
        );

        await applyAdvanceAndResetDebit(patientId, deduct);

        console.log(
          `PerSession bill created for ${patient.patientName} | 26 sessions | Invoice: ${invoiceNo}`,
        );
      }
    }
  } catch (err) {
    console.error("Billing Error:", err);
  }
};

exports.processMonthlyPayroll = async () => {
  try {
    const today = new Date();
    const startRange = new Date(today.getFullYear(), today.getMonth() - 1, 20);
    const endRange = new Date(
      today.getFullYear(),
      today.getMonth(),
      20,
      23,
      59,
      59,
    );
    const physios = await Physio.find({ isActive: true });

    for (const p of physios) {
      const pet =
        (
          await PetrolAllowance.aggregate([
            {
              $match: {
                physioId: p._id,
                date: { $gte: startRange, $lte: endRange },
                status: { $in: ["Approved", "Paid"] },
              },
            },
            { $group: { _id: null, total: { $sum: "$finalDailyKms" } } },
          ])
        )[0]?.total || 0;
      const sess =
        (
          await Session.aggregate([
            {
              $match: {
                physioId: p._id,
                sessionDate: { $gte: startRange, $lte: endRange },
              },
            },
            {
              $group: {
                _id: null,
                comp: {
                  $sum: {
                    $cond: [
                      {
                        $eq: [
                          "$sessionStatusId",
                          new mongoose.Types.ObjectId(
                            "691ec69eae0e10763c8f21e0",
                          ),
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ])
        )[0]?.comp || 0;
      const leaves = await LeaveModel.countDocuments({
        physioId: p._id,
        LeaveDate: { $gte: startRange, $lte: endRange },
        PaidLeave: false,
        isActive: true,
      });

      const deduct = Math.round((p.physioSalary / 30) * leaves);
      const gross =
        (p.physioSalary || 0) +
        (p.physioVehicleMTC || 0) +
        (p.physioIncentive || 0) * sess +
        pet * (p.physioPetrolAlw || 0);

      await Payroll.findOneAndUpdate(
        {
          physioId: p._id,
          payrRollMonth: today.toLocaleString("default", { month: "long" }),
          payrRollYear: today.getFullYear(),
        },
        {
          payRollDate: today,
          PetrolKm: pet,
          TotalSalary: Math.round(gross),
          NetSalary: Math.round(gross - deduct),
          NoofLeave: leaves,
          TotalAmountDeducted: deduct,
          payrRollCompletedSessions: sess,
        },
        { upsert: true },
      );
    }
  } catch (err) {
    console.error("Payroll Error:", err);
  }
};

// --- INITIALIZERS (Server.js) ---
exports.initDailySessionGeneration = () =>
  cron.schedule("0 5 * * 1-6", () => this.processDailySessionGeneration(), {
    timezone: "Asia/Kolkata",
  });
exports.initScheduledReviewGeneration = () =>
  cron.schedule("0 5 * * 1-6", () => this.processScheduledReviewGeneration(), {
    timezone: "Asia/Kolkata",
  });
exports.initReturnJourneyAllowanceCron = () =>
  cron.schedule("30 19 * * *", () => this.processReturnJourneyAllowance(), {
    timezone: "Asia/Kolkata",
  });
exports.initSessionCron = (io) =>
  cron.schedule("0 20 * * 1-6", () => this.processSessionPendingCheck(io), {
    timezone: "Asia/Kolkata",
  });
exports.initMonthlyBillingGeneration = () =>
  // cron.schedule("0 8 28-31 * *", () => this.processMonthlyBilling(), {
  cron.schedule("59 18 26 * *", () => this.processMonthlyBilling(), {
    // cron.schedule("39 11 23 * *", () => this.processMonthlyBilling(), {
    timezone: "Asia/Kolkata",
  });
exports.initMonthlyPayrollCron = () =>
  cron.schedule("30 9 28-31 * *", () => this.processMonthlyPayroll(), {
    timezone: "Asia/Kolkata",
  });
