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
    );

    const billingData = await Session.aggregate([
      {
        $match: {
          sessionStatusId: new mongoose.Types.ObjectId(
            "691ec69eae0e10763c8f21e0",
          ),
          sessionDate: { $gte: startOfMonth, $lte: endOfMonth },
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

    for (const item of billingData) {
      const patient = await Patient.findById(item._id).populate("FeesTypeId");

      if (
        !patient ||
        patient.FeesTypeId?.feesTypeName === "PerMonth" ||
        !item.physioId
      ) {
        continue;
      }

      const month = today.toLocaleString("default", { month: "long" });
      const year = today.getFullYear();

      // 🔴 ADD THIS CHECK
      const existingBill = await Bill.findOne({
        patientId: item._id,
        month,
        year,
      });

      if (existingBill) {
        console.log("Bill already exists for:", patient.patientName);
        continue; // ⛔ skip
      }

      const totalBill = (patient.feeAmount || 0) * item.count;

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

      const newBill = await Bill.create({
        patientId: item._id,
        physioId: item.physioId,
        paymentStatus: "Pending",
        ReceivedAmount: deduct,
        TotalBilledAmount: totalBill,
        DeductedFromAdvance: deduct,
        NetBilledAmount: totalBill - deduct,
        startDate: item.firstDate,
        ToDate: item.lastDate,
        ratePerSession: patient.feeAmount,
        TotalSessionCount: item.count,
        month,
        year,
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
  cron.schedule("0 8 28-31 * *", () => this.processMonthlyBilling(), {
    // cron.schedule("39 11 23 * *", () => this.processMonthlyBilling(), {
    // cron.schedule("39 11 23 * *", () => this.processMonthlyBilling(), {
    timezone: "Asia/Kolkata",
  });
exports.initMonthlyPayrollCron = () =>
  cron.schedule("30 9 28-31 * *", () => this.processMonthlyPayroll(), {
    timezone: "Asia/Kolkata",
  });
