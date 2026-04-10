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
      //  ADD THIS FILTER
      const filter = {
        toEmployeeId: admin._id,
        type,
      };

      if (meta?.ReviewId) {
        filter["meta.ReviewId"] = meta.ReviewId;
      }

      if (meta?.SessionId) {
        filter["meta.SessionId"] = meta.SessionId;
      }

      //  ADD THIS CHECK
      const existing = await Notification.findOne(filter).lean();

      if (existing) {
        continue; // skip duplicate
      }

      // CREATE ONLY IF NOT EXISTS
      const newNotification = await Notification.create({
        toEmployeeId: admin._id,
        message,
        type,
        status: "unseen",
        meta,
      });

      //  CHANGE THIS (send full object, not just message)
      if (io) {
        io.to(admin._id.toString()).emit(
          "receiveNotification",
          newNotification,
        );
      }
    } catch (err) {
      console.error(`❌ Notification Error:`, err.message);
    }
  }
}

// --- CORE PROCESS FUNCTIONS ---

// exports.processDailySessionGeneration = async () => {
//   try {
//     const { start, end } = getISTDateRange();

//     const completedStatusId = "691ec69eae0e10763c8f21e0";
//     const pendingStatusId = "691ecb36b87c5c57dead47a7";

//     // skip Sunday fully
//     if (start.getDay() === 0) {
//       console.log("⏭ Sunday - session generation skipped.");
//       return;
//     }

//     const activePatients = await Patient.find({
//       isRecovered: false,
//       sessionStartDate: { $lte: end },
//     }).sort({ visitOrder: 1 });

//     const isSameDay = (d1, d2) => {
//       const a = new Date(d1);
//       const b = new Date(d2);

//       return (
//         a.getFullYear() === b.getFullYear() &&
//         a.getMonth() === b.getMonth() &&
//         a.getDate() === b.getDate()
//       );
//     };

//     const getNextWorkingDay = (date) => {
//       const d = new Date(date);
//       d.setHours(0, 0, 0, 0);

//       do {
//         d.setDate(d.getDate() + 1);
//       } while (d.getDay() === 0);

//       return d;
//     };

//     const getFrequencyNumber = (patient) => {
//       return Number(
//         patient.Frequency ??
//           patient.frequency ??
//           patient.sessionFrequency ??
//           patient.visitFrequency ??
//           6,
//       );
//     };

//     // for frequency = 3
//     // builds pattern like Mon-Wed-Fri / Tue-Thu-Sat based on sessionStartDate
//     const getThreeDayPattern = (sessionStartDate) => {
//       const first = new Date(sessionStartDate);
//       first.setHours(0, 0, 0, 0);

//       while (first.getDay() === 0) {
//         first.setDate(first.getDate() + 1);
//       }

//       const pattern = [first.getDay()];

//       let second = getNextWorkingDay(first); // skip one working day
//       second = getNextWorkingDay(second); // actual next session day
//       pattern.push(second.getDay());

//       let third = getNextWorkingDay(second); // skip one working day
//       third = getNextWorkingDay(third); // actual next session day
//       pattern.push(third.getDay());

//       return pattern;
//     };

//     const shouldGenerateToday = (patient, today) => {
//       const frequency = getFrequencyNumber(patient);

//       // 6 days => every day except Sunday
//       if (frequency === 6) {
//         return today.getDay() !== 0;
//       }

//       // 3 days => fixed weekly pattern from sessionStartDate
//       if (frequency === 3) {
//         const sessionStartDate = new Date(patient.sessionStartDate);
//         sessionStartDate.setHours(0, 0, 0, 0);

//         const patternDays = getThreeDayPattern(sessionStartDate);
//         return patternDays.includes(today.getDay());
//       }

//       // fallback
//       return today.getDay() !== 0;
//     };

//     for (const patient of activePatients) {
//       if (!patient.activeCycleId) {
//         console.log(
//           `❌ Skipping patient ${patient._id} - No activeCycleId found`,
//         );
//         continue;
//       }

//       const exists = await Session.findOne({
//         patientId: patient._id,
//         cycleId: patient.activeCycleId,
//         sessionDate: { $gte: start, $lte: end },
//       });

//       if (exists) continue;

//       const sessionStartDate = new Date(patient.sessionStartDate);
//       sessionStartDate.setHours(0, 0, 0, 0);

//       if (start < sessionStartDate) {
//         continue;
//       }

//       const shouldCreate = shouldGenerateToday(patient, start);

//       if (!shouldCreate) {
//         console.log(
//           `⏭ Skipping patient ${patient._id} - today is not valid for frequency ${getFrequencyNumber(patient)}`,
//         );
//         continue;
//       }

//       let finalPhysioId = patient.physioId;
//       let finalSessionTime = patient.sessionTime;

//       const leaveRecord = await LeaveModel.findOne({
//         physioId: patient.physioId,
//         LeaveDate: { $gte: start, $lte: end },
//         isActive: true,
//       });

//       if (leaveRecord?.SessionGenerateForLeave) {
//         const reassignmentData = leaveRecord.SessionGenerateForLeave.find(
//           (item) => item.patientId?.toString() === patient._id.toString(),
//         );

//         if (reassignmentData?.Re_Assign) {
//           finalPhysioId = reassignmentData.Re_Assign;
//           finalSessionTime =
//             reassignmentData.sessionTime || patient.sessionTime;
//         } else {
//           console.log(
//             `Skipping session for patient ${patient._id} because physio is on leave and no reassignment found`,
//           );
//           continue;
//         }
//       }

//       const counter = await Counter.findOneAndUpdate(
//         { _id: "sessionCode" },
//         { $inc: { seq: 1 } },
//         { new: true, upsert: true },
//       );

//       const completedCount = await Session.countDocuments({
//         patientId: patient._id,
//         cycleId: patient.activeCycleId,
//         sessionStatusId: completedStatusId,
//       });

//       const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
//       const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 1);

//       const monthlyCompletedCount = await Session.countDocuments({
//         patientId: patient._id,
//         cycleId: patient.activeCycleId,
//         sessionStatusId: completedStatusId,
//         sessionDate: { $gte: monthStart, $lt: monthEnd },
//       });

//       await Session.create({
//         sessionCode: `SESS-${String(counter.seq).padStart(6, "0")}`,
//         patientId: patient._id,
//         cycleId: patient.activeCycleId,
//         physioId: finalPhysioId?._id || finalPhysioId,
//         sessionDate: start,
//         sessionDay: start.toLocaleDateString("en-IN", { weekday: "long" }),
//         sessionTime: finalSessionTime,
//         targetArea: patient.targetedArea,
//         sessionStatusId: pendingStatusId,
//         sessionCount: completedCount + 1,
//         monthlySessionCount: monthlyCompletedCount + 1,
//         modeOfExercise: "General",
//       });
//     }

//     console.log("✅ 5 AM: Sessions Generated.");
//   } catch (err) {
//     console.error("5AM Error:", err);
//   }
// };
exports.processDailySessionGeneration = async () => {
  try {
    const { start, end } = getISTDateRange();

    const completedStatusId = "691ec69eae0e10763c8f21e0";
    const pendingStatusId = "691ecb36b87c5c57dead47a7";

    // Skip Sunday fully
    if (start.getDay() === 0) {
      console.log("⏭ Sunday - session generation skipped.");
      return;
    }

    const activePatients = await Patient.find({
      isRecovered: false,
      sessionStartDate: { $lte: end },
    }).sort({ visitOrder: 1 });

    for (const patient of activePatients) {
      try {
        // active cycle mandatory
        if (!patient.activeCycleId) {
          console.log(
            `❌ Skipping patient ${patient._id} - No activeCycleId found`,
          );
          continue;
        }

        // don't create duplicate session for same day
        const exists = await Session.findOne({
          patientId: patient._id,
          cycleId: patient.activeCycleId,
          sessionDate: { $gte: start, $lte: end },
        });

        if (exists) {
          console.log(
            `⏭ Session already exists for patient ${patient._id} on this date`,
          );
          continue;
        }

        const sessionStartDate = new Date(patient.sessionStartDate);
        sessionStartDate.setHours(0, 0, 0, 0);

        // don't create before patient start date
        if (start < sessionStartDate) {
          console.log(
            `⏭ Skipping patient ${patient._id} - sessionStartDate not reached`,
          );
          continue;
        }

        let finalPhysioId = patient.physioId;
        let finalSessionTime = patient.sessionTime;

        // Check physio leave and reassignment
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
              `⏭ Skipping patient ${patient._id} - physio on leave and no reassignment found`,
            );
            continue;
          }
        }

        // Session code counter
        const counter = await Counter.findOneAndUpdate(
          { _id: "sessionCode" },
          { $inc: { seq: 1 } },
          { new: true, upsert: true },
        );

        // Total completed session count for this cycle
        const completedCount = await Session.countDocuments({
          patientId: patient._id,
          cycleId: patient.activeCycleId,
          sessionStatusId: completedStatusId,
        });

        // Monthly completed session count for this cycle
        const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
        const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 1);

        const monthlyCompletedCount = await Session.countDocuments({
          patientId: patient._id,
          cycleId: patient.activeCycleId,
          sessionStatusId: completedStatusId,
          sessionDate: { $gte: monthStart, $lt: monthEnd },
        });

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

        console.log(`✅ Session created for patient ${patient._id}`);
      } catch (patientErr) {
        console.error(
          `❌ Error while creating session for patient ${patient._id}:`,
          patientErr,
        );
      }
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
    const endOfToday = new Date(end);
    const roles = await RoleBased.find({
      RoleName: { $in: ["Admin", "SuperAdmin", "HOD"] },
    });
    const admins = await Physio.find({
      roleId: { $in: roles.map((r) => r._id) },
      isActive: true,
    });

    const pendSessions = await Session.find({
      sessionDate: { $lte: endOfToday },
      // sessionDate: { $gte: start, $lte: end },
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

// exports.processMonthlyBilling = async () => {
//   try {
//     const today = new Date();

//     const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
//     const endOfMonth = new Date(
//       today.getFullYear(),
//       today.getMonth() + 1,
//       0,
//       23,
//       59,
//       59,
//       999,
//     );

//     const month = today.toLocaleString("default", { month: "long" });
//     const year = today.getFullYear();

//     // helper for invoice no
//     // const getNextInvoiceNo = async () => {
//     //   const lastBill = await Bill.findOne({ invoiceNo: { $exists: true } })
//     //     .sort({ invoiceNo: -1 })
//     //     .select("invoiceNo");

//     //   let invoiceNo = 100001;

//     //   if (lastBill?.invoiceNo) {
//     //     invoiceNo = Number(lastBill.invoiceNo) + 1;
//     //   }

//     //   return invoiceNo;
//     // };
//     const counter = await Counter.findOneAndUpdate(
//       { _id: "invoiceNo" },
//       { $inc: { seq: 1 } },
//       { new: true, upsert: true },
//     );
//     // helper for fee type
//     const getNormalizedFeeType = (patient) => {
//       return String(
//         patient?.FeesTypeId?.FeesTypeName ||
//           patient?.FeesTypeId?.feesTypeName ||
//           patient?.FeesTypeId?.name ||
//           patient?.FeesTypeId?.feeTypeName ||
//           "",
//       )
//         .trim()
//         .toLowerCase()
//         .replace(/\s+/g, "");
//     };

//     // helper for advance usage
//     const applyAdvanceAndResetDebit = async (patientId, deductAmount) => {
//       if (!deductAmount || deductAmount <= 0) return;

//       let remainingDeduct = Number(deductAmount || 0);

//       const debitEntries = await Debit.find({
//         patientId,
//         DebitAmount: { $gt: 0 },
//       }).sort({ createdAt: 1 });

//       for (const debit of debitEntries) {
//         if (remainingDeduct <= 0) break;

//         const currentDebitAmount = Number(debit.DebitAmount || 0);

//         if (currentDebitAmount <= remainingDeduct) {
//           remainingDeduct -= currentDebitAmount;
//           debit.DebitAmount = 0;
//         } else {
//           debit.DebitAmount = Number(
//             (currentDebitAmount - remainingDeduct).toFixed(2),
//           );
//           remainingDeduct = 0;
//         }

//         await debit.save();
//       }
//     };

//     // get all patients who have unbilled completed sessions
//     const patientsWithUnbilledSessions = await Session.aggregate([
//       {
//         $match: {
//           sessionStatusId: new mongoose.Types.ObjectId(
//             "691ec69eae0e10763c8f21e0",
//           ),
//           isBilled: false,
//         },
//       },
//       {
//         $group: {
//           _id: "$patientId",
//         },
//       },
//     ]);

//     for (const row of patientsWithUnbilledSessions) {
//       const patientId = row._id;

//       const patient = await Patient.findById(patientId).populate("FeesTypeId");

//       if (!patient) continue;

//       const feeTypeName = getNormalizedFeeType(patient);
//       const isPerMonth = feeTypeName === "permonth";
//       const isPerSession = feeTypeName === "persession";

//       // =========================
//       // 1) PER MONTH BILLING
//       // =========================
//       if (isPerMonth) {
//         const monthlySessions = await Session.find({
//           patientId,
//           sessionStatusId: new mongoose.Types.ObjectId(
//             "691ec69eae0e10763c8f21e0",
//           ),
//           sessionDate: { $gte: startOfMonth, $lte: endOfMonth },
//           isBilled: false,
//         }).sort({ sessionDate: 1 });

//         if (!monthlySessions.length) {
//           continue;
//         }

//         const existingBill = await Bill.findOne({
//           patientId,
//           month,
//           year,
//           feeType: "permonth",
//         });

//         if (existingBill) {
//           console.log("Monthly bill already exists for:", patient.patientName);
//           continue;
//         }

//         const physioId =
//           monthlySessions[0]?.physioId || patient?.physioId || null;

//         if (!physioId) continue;

//         const feeAmount = Number(patient?.feeAmount || 0);
//         const totalBill = feeAmount;

//         const advPaidAgg = await Debit.aggregate([
//           { $match: { patientId } },
//           { $group: { _id: null, total: { $sum: "$DebitAmount" } } },
//         ]);
//         const advPaid = advPaidAgg[0]?.total || 0;

//         const usedAdvAgg = await Bill.aggregate([
//           { $match: { patientId } },
//           { $group: { _id: null, total: { $sum: "$DeductedFromAdvance" } } },
//         ]);
//         const usedAdv = usedAdvAgg[0]?.total || 0;

//         const availableAdvance = Math.max(advPaid - usedAdv, 0);
//         const deduct = Math.min(availableAdvance, totalBill);
//         const netBilledAmount = totalBill - deduct;

//         // const invoiceNo = await getNextInvoiceNo();
//         const invoiceNo = `HNI-${String(counter.seq).padStart(6, "0")}`;

//         const newBill = await Bill.create({
//           patientId,
//           invoiceNo,
//           physioId,
//           paymentStatus: netBilledAmount <= 0 ? "Paid" : "Pending",
//           paymentType:
//             netBilledAmount <= 0
//               ? "Full Payment"
//               : deduct > 0
//                 ? "Partial Payment"
//                 : "Full Payment",
//           ReceivedAmount: Number(deduct.toFixed(2)),
//           TotalBilledAmount: Number(totalBill.toFixed(2)),
//           DeductedFromAdvance: Number(deduct.toFixed(2)),
//           NetBilledAmount: Number(netBilledAmount.toFixed(2)),
//           startDate: monthlySessions[0].sessionDate,
//           ToDate: monthlySessions[monthlySessions.length - 1].sessionDate,
//           ratePerSession: 0,
//           totalAmount: Number(totalBill.toFixed(2)),
//           TotalSessionCount: monthlySessions.length,
//           month,
//           year,
//           isComplete: netBilledAmount <= 0,
//           feeType: "permonth",
//         });

//         await Session.updateMany(
//           { _id: { $in: monthlySessions.map((s) => s._id) } },
//           {
//             $set: {
//               isBilled: true,
//               billId: newBill._id,
//             },
//           },
//         );

//         await applyAdvanceAndResetDebit(patientId, deduct);

//         console.log(
//           `PerMonth bill created for ${patient.patientName} | Invoice: ${invoiceNo}`,
//         );

//         continue;
//       }

//       // =========================
//       // 2) PER SESSION BILLING
//       // =========================
//       if (isPerSession) {
//         const unbilledSessions = await Session.find({
//           patientId,
//           sessionStatusId: new mongoose.Types.ObjectId(
//             "691ec69eae0e10763c8f21e0",
//           ),
//           isBilled: false,
//         }).sort({ sessionDate: 1 });

//         if (unbilledSessions.length < 26) {
//           console.log(
//             `Skipping ${patient.patientName} - only ${unbilledSessions.length} sessions`,
//           );
//           continue;
//         }

//         // take only first 26 sessions for one bill
//         const sessionsToBill = unbilledSessions.slice(0, 26);

//         const physioId =
//           sessionsToBill[0]?.physioId || patient?.physioId || null;
//         if (!physioId) continue;

//         const billMonth = new Date(
//           sessionsToBill[sessionsToBill.length - 1].sessionDate,
//         ).toLocaleString("default", { month: "long" });
//         const billYear = new Date(
//           sessionsToBill[sessionsToBill.length - 1].sessionDate,
//         ).getFullYear();

//         const existingBill = await Bill.findOne({
//           patientId,
//           month: billMonth,
//           year: billYear,
//           feeType: "persession",
//           startDate: sessionsToBill[0].sessionDate,
//           ToDate: sessionsToBill[sessionsToBill.length - 1].sessionDate,
//         });

//         if (existingBill) {
//           console.log(
//             "PerSession bill already exists for:",
//             patient.patientName,
//           );
//           continue;
//         }

//         const feeAmount = Number(patient?.feeAmount || 0);
//         const totalBill = feeAmount * 26;

//         const advPaidAgg = await Debit.aggregate([
//           { $match: { patientId } },
//           { $group: { _id: null, total: { $sum: "$DebitAmount" } } },
//         ]);
//         const advPaid = advPaidAgg[0]?.total || 0;

//         const usedAdvAgg = await Bill.aggregate([
//           { $match: { patientId } },
//           { $group: { _id: null, total: { $sum: "$DeductedFromAdvance" } } },
//         ]);
//         const usedAdv = usedAdvAgg[0]?.total || 0;

//         const availableAdvance = Math.max(advPaid - usedAdv, 0);
//         const deduct = Math.min(availableAdvance, totalBill);
//         const netBilledAmount = totalBill - deduct;

//         const invoiceNo = await getNextInvoiceNo();

//         const newBill = await Bill.create({
//           patientId,
//           invoiceNo,
//           physioId,
//           paymentStatus: netBilledAmount <= 0 ? "Paid" : "Pending",
//           paymentType:
//             netBilledAmount <= 0
//               ? "Full Payment"
//               : deduct > 0
//                 ? "Partial Payment"
//                 : "Full Payment",
//           ReceivedAmount: Number(deduct.toFixed(2)),
//           TotalBilledAmount: Number(totalBill.toFixed(2)),
//           DeductedFromAdvance: Number(deduct.toFixed(2)),
//           NetBilledAmount: Number(netBilledAmount.toFixed(2)),
//           startDate: sessionsToBill[0].sessionDate,
//           ToDate: sessionsToBill[sessionsToBill.length - 1].sessionDate,
//           ratePerSession: Number(feeAmount.toFixed(2)),
//           totalAmount: Number(totalBill.toFixed(2)),
//           TotalSessionCount: 26,
//           month: billMonth,
//           year: billYear,
//           isComplete: netBilledAmount <= 0,
//           feeType: "persession",
//         });

//         await Session.updateMany(
//           { _id: { $in: sessionsToBill.map((s) => s._id) } },
//           {
//             $set: {
//               isBilled: true,
//               billId: newBill._id,
//             },
//           },
//         );

//         await applyAdvanceAndResetDebit(patientId, deduct);

//         console.log(
//           `PerSession bill created for ${patient.patientName} | 26 sessions | Invoice: ${invoiceNo}`,
//         );
//       }
//     }
//   } catch (err) {
//     console.error("Billing Error:", err);
//   }
// };

// exports.processMonthlyBilling = async () => {
//   try {
//     const today = new Date();

//     // 1. CALCULATE LAST DAY OF CURRENT MONTH
//     // Setting day to '0' of the next month gives us the last day of the current month
//     const lastDayDateObject = new Date(today.getFullYear(), today.getMonth() + 1, 0);
//     const lastDayOfMonth = lastDayDateObject.getDate();

//     // 2. THE SAFETY GATE
//     // If today is NOT the last day, stop execution immediately.
//     if (today.getDate() !== lastDayOfMonth) {
//       console.log(`[Billing] Skipping: Today is ${today.getDate()}. Billing will run on the ${lastDayOfMonth}th.`);
//       return;
//     }

//     console.log(`[Billing] Starting month-end processing for ${today.toDateString()}...`);

//     const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
//     const endOfMonth = new Date(today.getFullYear(), today.getMonth(), lastDayOfMonth, 23, 59, 59, 999);

//     const monthName = today.toLocaleString("default", { month: "long" });
//     const currentYear = today.getFullYear();

//     // Helper: Normalize Fee Type
//     const getNormalizedFeeType = (patient) => {
//       const type = patient?.FeesTypeId?.FeesTypeName ||
//                    patient?.FeesTypeId?.feesTypeName ||
//                    patient?.FeesTypeId?.name ||
//                    patient?.FeesTypeId?.feeTypeName || "";
//       return String(type).trim().toLowerCase().replace(/\s+/g, "");
//     };

//     // Helper: Apply Advance Logic
//     const applyAdvanceAndResetDebit = async (patientId, deductAmount) => {
//       if (!deductAmount || deductAmount <= 0) return;
//       let remainingDeduct = Number(deductAmount);

//       const debitEntries = await Debit.find({
//         patientId,
//         DebitAmount: { $gt: 0 },
//       }).sort({ createdAt: 1 });

//       for (const debit of debitEntries) {
//         if (remainingDeduct <= 0) break;
//         const currentDebitAmount = Number(debit.DebitAmount || 0);

//         if (currentDebitAmount <= remainingDeduct) {
//           remainingDeduct -= currentDebitAmount;
//           debit.DebitAmount = 0;
//         } else {
//           debit.DebitAmount = Number((currentDebitAmount - remainingDeduct).toFixed(2));
//           remainingDeduct = 0;
//         }
//         await debit.save();
//       }
//     };

//     // 3. GET PATIENTS WITH UNBILLED SESSIONS
//     const patientsWithUnbilledSessions = await Session.aggregate([
//       {
//         $match: {
//           sessionStatusId: new mongoose.Types.ObjectId("691ec69eae0e10763c8f21e0"),
//           isBilled: false,
//         },
//       },
//       { $group: { _id: "$patientId" } },
//     ]);

//     for (const row of patientsWithUnbilledSessions) {
//       const patientId = row._id;
//       const patient = await Patient.findById(patientId).populate("FeesTypeId");
//       if (!patient) continue;

//       const feeTypeName = getNormalizedFeeType(patient);
//       const isPerMonth = feeTypeName === "permonth";
//       const isPerSession = feeTypeName === "persession";

//       // ---------------------------------------------------------
//       // CASE 1: PER MONTH BILLING
//       // ---------------------------------------------------------
//       if (isPerMonth) {
//         const monthlySessions = await Session.find({
//           patientId,
//           sessionStatusId: new mongoose.Types.ObjectId("691ec69eae0e10763c8f21e0"),
//           sessionDate: { $gte: startOfMonth, $lte: endOfMonth },
//           isBilled: false,
//         }).sort({ sessionDate: 1 });

//         if (!monthlySessions.length) continue;

//         const existingBill = await Bill.findOne({
//           patientId,
//           month: monthName,
//           year: currentYear,
//           feeType: "permonth",
//         });

//         if (existingBill) {
//           console.log(`[Billing] Bill already exists for ${patient.patientName} (PerMonth)`);
//           continue;
//         }

//         const physioId = monthlySessions[0]?.physioId || patient?.physioId;
//         if (!physioId) continue;

//         const totalBill = Number(patient?.feeAmount || 0);

//         // Calculate Advance Balance
//         const advPaidAgg = await Debit.aggregate([
//           { $match: { patientId } },
//           { $group: { _id: null, total: { $sum: "$DebitAmount" } } },
//         ]);
//         const usedAdvAgg = await Bill.aggregate([
//           { $match: { patientId } },
//           { $group: { _id: null, total: { $sum: "$DeductedFromAdvance" } } },
//         ]);

//         const availableAdvance = Math.max((advPaidAgg[0]?.total || 0) - (usedAdvAgg[0]?.total || 0), 0);
//         const deduct = Math.min(availableAdvance, totalBill);
//         const netBilledAmount = totalBill - deduct;

//         // GENERATE UNIQUE INVOICE NO
//         const counter = await Counter.findOneAndUpdate(
//           { _id: "invoiceNo" },
//           { $inc: { seq: 1 } },
//           { new: true, upsert: true }
//         );
//         const invoiceNo = `HNI-${String(counter.seq).padStart(6, "0")}`;

//         const newBill = await Bill.create({
//           patientId,
//           invoiceNo,
//           physioId,
//           paymentStatus: netBilledAmount <= 0 ? "Paid" : "Pending",
//           paymentType: netBilledAmount <= 0 ? "Full Payment" : (deduct > 0 ? "Partial Payment" : "Full Payment"),
//           ReceivedAmount: Number(deduct.toFixed(2)),
//           TotalBilledAmount: Number(totalBill.toFixed(2)),
//           DeductedFromAdvance: Number(deduct.toFixed(2)),
//           NetBilledAmount: Number(netBilledAmount.toFixed(2)),
//           startDate: monthlySessions[0].sessionDate,
//           ToDate: monthlySessions[monthlySessions.length - 1].sessionDate,
//           ratePerSession: 0,
//           totalAmount: Number(totalBill.toFixed(2)),
//           TotalSessionCount: monthlySessions.length,
//           month: monthName,
//           year: currentYear,
//           isComplete: netBilledAmount <= 0,
//           feeType: "permonth",
//         });

//         await Session.updateMany(
//           { _id: { $in: monthlySessions.map((s) => s._id) } },
//           { $set: { isBilled: true, billId: newBill._id } }
//         );

//         await applyAdvanceAndResetDebit(patientId, deduct);
//         console.log(`[Billing] Created ${invoiceNo} for ${patient.patientName}`);
//       }

//       // ---------------------------------------------------------
//       // CASE 2: PER SESSION BILLING
//       // ---------------------------------------------------------
//       if (isPerSession) {
//         const unbilledSessions = await Session.find({
//           patientId,
//           sessionStatusId: new mongoose.Types.ObjectId("691ec69eae0e10763c8f21e0"),
//           isBilled: false,
//           sessionDate: { $gte: startOfMonth, $lte: endOfMonth }
//         }).sort({ sessionDate: 1 });

//         // Change this logic if you want to bill even if sessions are < 26 at month end
//         if (unbilledSessions.length < 26) {
//           console.log(`[Billing] Skipping ${patient.patientName}: Only ${unbilledSessions.length}/26 sessions found.`);
//           continue;
//         }

//         const sessionsToBill = unbilledSessions.slice(0, 26);
//         const physioId = sessionsToBill[0]?.physioId || patient?.physioId;
//         if (!physioId) continue;

//         const totalBill = Number(patient?.feeAmount || 0) * 26;

//         const advPaidAgg = await Debit.aggregate([
//           { $match: { patientId } },
//           { $group: { _id: null, total: { $sum: "$DebitAmount" } } },
//         ]);
//         const usedAdvAgg = await Bill.aggregate([
//           { $match: { patientId } },
//           { $group: { _id: null, total: { $sum: "$DeductedFromAdvance" } } },
//         ]);

//         const availableAdvance = Math.max((advPaidAgg[0]?.total || 0) - (usedAdvAgg[0]?.total || 0), 0);
//         const deduct = Math.min(availableAdvance, totalBill);
//         const netBilledAmount = totalBill - deduct;

//         const counter = await Counter.findOneAndUpdate(
//           { _id: "invoiceNo" },
//           { $inc: { seq: 1 } },
//           { new: true, upsert: true }
//         );
//         const invoiceNo = `HNI-${String(counter.seq).padStart(6, "0")}`;

//         const newBill = await Bill.create({
//           patientId,
//           invoiceNo,
//           physioId,
//           paymentStatus: netBilledAmount <= 0 ? "Paid" : "Pending",
//           paymentType: netBilledAmount <= 0 ? "Full Payment" : (deduct > 0 ? "Partial Payment" : "Full Payment"),
//           ReceivedAmount: Number(deduct.toFixed(2)),
//           TotalBilledAmount: Number(totalBill.toFixed(2)),
//           DeductedFromAdvance: Number(deduct.toFixed(2)),
//           NetBilledAmount: Number(netBilledAmount.toFixed(2)),
//           startDate: sessionsToBill[0].sessionDate,
//           ToDate: sessionsToBill[sessionsToBill.length - 1].sessionDate,
//           ratePerSession: Number((patient?.feeAmount || 0).toFixed(2)),
//           totalAmount: Number(totalBill.toFixed(2)),
//           TotalSessionCount: 26,
//           month: monthName,
//           year: currentYear,
//           isComplete: netBilledAmount <= 0,
//           feeType: "persession",
//         });

//         await Session.updateMany(
//           { _id: { $in: sessionsToBill.map((s) => s._id) } },
//           { $set: { isBilled: true, billId: newBill._id } }
//         );

//         await applyAdvanceAndResetDebit(patientId, deduct);
//         console.log(`[Billing] Created ${invoiceNo} (26 Sessions) for ${patient.patientName}`);
//       }
//     }
//     console.log(`[Billing] Monthly process completed successfully.`);
//   } catch (err) {
//     console.error("Critical Billing Error:", err);
//   }
// };

exports.processMonthlyBilling = async () => {
  try {
    const today = new Date();

    // 1. CALCULATE LAST DAY OF CURRENT MONTH
    const lastDayDateObject = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
    );
    const lastDayOfMonth = lastDayDateObject.getDate();

    // 2. THE SAFETY GATE
    if (today.getDate() !== lastDayOfMonth) {
      console.log(
        `[Billing] Skipping: Today is ${today.getDate()}. Billing will run on the ${lastDayOfMonth}th.`,
      );
      return;
    }

    console.log(
      `[Billing] Starting month-end processing for ${today.toDateString()}...`,
    );

    const startOfMonth = new Date(
      today.getFullYear(),
      today.getMonth(),
      1,
      0,
      0,
      0,
      0,
    );
    const endOfMonth = new Date(
      today.getFullYear(),
      today.getMonth(),
      lastDayOfMonth,
      23,
      59,
      59,
      999,
    );

    const monthName = today.toLocaleString("default", { month: "long" });
    const currentYear = today.getFullYear();

    // Helper: Normalize Fee Type
    const getNormalizedFeeType = (patient) => {
      const type =
        patient?.FeesTypeId?.FeesTypeName ||
        patient?.FeesTypeId?.feesTypeName ||
        patient?.FeesTypeId?.name ||
        patient?.FeesTypeId?.feeTypeName ||
        "";
      return String(type).trim().toLowerCase().replace(/\s+/g, "");
    };

    // Helper: Apply Advance Logic
    const applyAdvanceAndResetDebit = async (patientId, deductAmount) => {
      if (!deductAmount || deductAmount <= 0) return;
      let remainingDeduct = Number(deductAmount);

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

    // 3. GET PATIENTS WITH UNBILLED SESSIONS
    const patientsWithUnbilledSessions = await Session.aggregate([
      {
        $match: {
          sessionStatusId: new mongoose.Types.ObjectId(
            "691ec69eae0e10763c8f21e0",
          ),
          isBilled: false,
        },
      },
      { $group: { _id: "$patientId" } },
    ]);

    for (const row of patientsWithUnbilledSessions) {
      const patientId = row._id;
      const patient = await Patient.findById(patientId).populate("FeesTypeId");
      if (!patient) continue;

      const feeTypeName = getNormalizedFeeType(patient);
      console.log(feeTypeName, "feeTypeName");
      if (feeTypeName === "persession") {
        console.log("persession billing for:", patient.patientName);
        const unbilledSessions = await Session.find({
          patientId,
          sessionStatusId: new mongoose.Types.ObjectId(
            "691ec69eae0e10763c8f21e0",
          ),
          isBilled: false,
          sessionDate: { $gte: startOfMonth, $lte: endOfMonth },
        }).sort({ sessionDate: 1 });

        if (unbilledSessions.length === 0) continue;

        const sessionsToBill = unbilledSessions;
        const sessionCount = sessionsToBill.length;

        const physioId = sessionsToBill[0]?.physioId || patient?.physioId;
        if (!physioId) continue;

        // Total = Rate * however many sessions they actually did
        const totalBill = Number(patient?.feeAmount || 0) * sessionCount;

        // Calculate Advance Balance
        const advPaidAgg = await Debit.aggregate([
          { $match: { patientId } },
          { $group: { _id: null, total: { $sum: "$DebitAmount" } } },
        ]);
        const usedAdvAgg = await Bill.aggregate([
          { $match: { patientId } },
          { $group: { _id: null, total: { $sum: "$DeductedFromAdvance" } } },
        ]);

        const availableAdvance = Math.max(
          (advPaidAgg[0]?.total || 0) - (usedAdvAgg[0]?.total || 0),
          0,
        );
        const deduct = Math.min(availableAdvance, totalBill);
        const netBilledAmount = totalBill - deduct;

        const counter = await Counter.findOneAndUpdate(
          { _id: "invoiceNo" },
          { $inc: { seq: 1 } },
          { new: true, upsert: true },
        );
        const invoiceNo = `HNI-${String(counter.seq).padStart(6, "0")}`;

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
          ratePerSession: Number((patient?.feeAmount || 0).toFixed(2)),
          totalAmount: Number(totalBill.toFixed(2)),
          TotalSessionCount: sessionCount,
          month: monthName,
          year: currentYear,
          isComplete: netBilledAmount <= 0,
          feeType: "persession",
        });

        await Session.updateMany(
          { _id: { $in: sessionsToBill.map((s) => s._id) } },
          { $set: { isBilled: true, billId: newBill._id } },
        );

        await applyAdvanceAndResetDebit(patientId, deduct);
        console.log(
          `[Billing] Created ${invoiceNo} (${sessionCount} Sessions) for ${patient.patientName}`,
        );
      }
    }
    console.log(
      `[Billing] Monthly process (PerSession only) completed successfully.`,
    );
  } catch (err) {
    console.error("Critical Billing Error:", err);
  }
};

// exports.processMonthlyPayroll = async () => {
//   try {
//     const today = new Date();
//     const startRange = new Date(today.getFullYear(), today.getMonth() - 1, 20);
//     const endRange = new Date(
//       today.getFullYear(),
//       today.getMonth(),
//       20,
//       23,
//       59,
//       59,
//     );
//     const physios = await Physio.find({ isActive: true });

//     for (const p of physios) {
//       const pet =
//         (
//           await PetrolAllowance.aggregate([
//             {
//               $match: {
//                 physioId: p._id,
//                 date: { $gte: startRange, $lte: endRange },
//                 status: { $in: ["Approved", "Paid"] },
//               },
//             },
//             { $group: { _id: null, total: { $sum: "$finalDailyKms" } } },
//           ])
//         )[0]?.total || 0;
//       const sess =
//         (
//           await Session.aggregate([
//             {
//               $match: {
//                 physioId: p._id,
//                 sessionDate: { $gte: startRange, $lte: endRange },
//               },
//             },
//             {
//               $group: {
//                 _id: null,
//                 comp: {
//                   $sum: {
//                     $cond: [
//                       {
//                         $eq: [
//                           "$sessionStatusId",
//                           new mongoose.Types.ObjectId(
//                             "691ec69eae0e10763c8f21e0",
//                           ),
//                         ],
//                       },
//                       1,
//                       0,
//                     ],
//                   },
//                 },
//               },
//             },
//           ])
//         )[0]?.comp || 0;
//       const leaves = await LeaveModel.countDocuments({
//         physioId: p._id,
//         LeaveDate: { $gte: startRange, $lte: endRange },
//         PaidLeave: false,
//         isActive: true,
//       });

//       const deduct = Math.round((p.physioSalary / 30) * leaves);
//       const gross =
//         (p.physioSalary || 0) +
//         (p.physioVehicleMTC || 0) +
//         (p.physioIncentive || 0) * sess +
//         pet * (p.physioPetrolAlw || 0);

//       await Payroll.findOneAndUpdate(
//         {
//           physioId: p._id,
//           payrRollMonth: today.toLocaleString("default", { month: "long" }),
//           payrRollYear: today.getFullYear(),
//         },
//         {
//           payRollDate: today,
//           PetrolKm: pet,
//           TotalSalary: Math.round(gross),
//           NetSalary: Math.round(gross - deduct),
//           NoofLeave: leaves,
//           TotalAmountDeducted: deduct,
//           payrRollCompletedSessions: sess,
//         },
//         { upsert: true },
//       );
//     }
//   } catch (err) {
//     console.error("Payroll Error:", err);
//   }
// };

// --- INITIALIZERS (Server.js) ---

// exports.processMonthlyPayroll = async () => {
//   try {
//     const today = new Date();

//     /**
//      * SAFETY GATE:
//      * Your cycle ends on the 20th. We should generate the payroll on the 21st
//      * to ensure all data from the 20th has been synced/uploaded.
//      */

//     // 1. CALCULATE LAST DAY OF CURRENT MONTH
//     const lastDayDateObject = new Date(
//       today.getFullYear(),
//       today.getMonth() + 1,
//       0,
//     );
//     const lastDayOfMonth = lastDayDateObject.getDate();

//     // // 2. THE SAFETY GATE
//     if (today.getDate() !== lastDayOfMonth) {
//       console.log(
//         `[Payroll] Skipping: Today is ${today.getDate()}. Payroll will run on the ${lastDayOfMonth}th.`,
//       );
//       return;
//     }

//     console.log(
//       `[Payroll] Starting month-end processing for ${today.toDateString()}...`,
//     );

//     // RANGE CALCULATION: 20th of last month to 20th of this month
//     const startRange = new Date(
//       today.getFullYear(),
//       today.getMonth() - 1,
//       20,
//       0,
//       0,
//       0,
//       0,
//     );
//     const endRange = new Date(
//       today.getFullYear(),
//       today.getMonth(),
//       20,
//       23,
//       59,
//       59,
//       999,
//     );

//     const payrollMonth = today.toLocaleString("default", { month: "long" });
//     const payrollYear = today.getFullYear();

//     console.log(
//       `[Payroll] Starting generation for ${payrollMonth} ${payrollYear} (Cycle: 20th to 20th)`,
//     );

//     const physios = await Physio.find({ isActive: true });

//     for (const p of physios) {
//       // 1. Calculate Approved/Paid Petrol Kms
//       const petrolAgg = await PetrolAllowance.aggregate([
//         {
//           $match: {
//             physioId: p._id,
//             date: { $gte: startRange, $lte: endRange },
//             status: { $in: ["Approved", "Paid"] },
//           },
//         },
//         { $group: { _id: null, total: { $sum: "$finalDailyKms" } } },
//       ]);
//       const totalKms = petrolAgg[0]?.total || 0;

//       // 2. Calculate Completed Sessions Count
//       const sessionAgg = await Session.aggregate([
//         {
//           $match: {
//             physioId: p._id,
//             sessionDate: { $gte: startRange, $lte: endRange },
//             sessionStatusId: new mongoose.Types.ObjectId(
//               "691ec69eae0e10763c8f21e0",
//             ),
//           },
//         },
//         { $group: { _id: null, count: { $sum: 1 } } },
//       ]);
//       const completedSessions = sessionAgg[0]?.count || 0;

//       // 3. Calculate Unpaid Leaves
//       const leavesCount = await LeaveModel.countDocuments({
//         physioId: p._id,
//         LeaveDate: { $gte: startRange, $lte: endRange },
//         PaidLeave: false,
//         isActive: true,
//       });

//       // 4. Salary Calculations
//       const baseSalary = Number(p.physioSalary || 0);
//       const vehicleMaintenance = Number(p.physioVehicleMTC || 0);
//       const incentivePerSession = Number(p.physioIncentive || 0);
//       const petrolRatePerKm = Number(p.physioPetrolAlw || 0);

//       // Deduction logic: Salary / 30 days * number of leaves
//       const deductionAmount = Math.round((baseSalary / 30) * leavesCount);

//       const grossSalary =
//         baseSalary +
//         vehicleMaintenance +
//         incentivePerSession * completedSessions +
//         totalKms * petrolRatePerKm;

//       const netSalary = grossSalary - deductionAmount;

//       // 5. Upsert Payroll Record
//       await Payroll.findOneAndUpdate(
//         {
//           physioId: p._id,
//           payrRollMonth: payrollMonth,
//           payrRollYear: payrollYear,
//         },
//         {
//           payRollDate: today,
//           PetrolKm: totalKms,
//           TotalSalary: Math.round(grossSalary),
//           NetSalary: Math.round(netSalary),
//           NoofLeave: leavesCount,
//           TotalAmountDeducted: deductionAmount,
//           payrRollCompletedSessions: completedSessions,
//           // Added metadata for audit logs
//           calculationCycle: `${startRange.toDateString()} to ${endRange.toDateString()}`,
//         },
//         { upsert: true, new: true },
//       );

//       console.log(
//         `[Payroll] Processed: ${p.physioName || p._id} | Net: ${Math.round(netSalary)}`,
//       );
//     }

//     console.log(`[Payroll] Monthly processing finished successfully.`);
//   } catch (err) {
//     console.error("Critical Payroll Error:", err);
//   }
// };

exports.processMonthlyPayroll = async () => {
  try {
    const today = new Date();

    // 1. CALCULATE LAST DAY OF CURRENT MONTH
    const lastDayDateObject = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
    );
    const lastDayOfMonth = lastDayDateObject.getDate();

    // 2. SAFETY GATE: run only on last day of month
    if (today.getDate() !== lastDayOfMonth) {
      console.log(
        `[Payroll] Skipping: Today is ${today.getDate()}. Payroll will run on the ${lastDayOfMonth}th.`,
      );
      return;
    }

    console.log(
      `[Payroll] Starting month-end processing for ${today.toDateString()}...`,
    );

    // 3. RANGE CALCULATION: 20th of last month to 20th of this month
    const startRange = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      20,
      0,
      0,
      0,
      0,
    );
    const endRange = new Date(
      today.getFullYear(),
      today.getMonth(),
      20,
      23,
      59,
      59,
      999,
    );

    const payrollMonth = today.toLocaleString("default", { month: "long" });
    const payrollYear = today.getFullYear();

    console.log(
      `[Payroll] Starting generation for ${payrollMonth} ${payrollYear} (Cycle: 20th to 20th)`,
    );

    const physios = await Physio.find({ isActive: true });

    for (const p of physios) {
      // 1. Calculate Approved/Paid/Pending Petrol Kms
      const petrolAgg = await PetrolAllowance.aggregate([
        {
          $match: {
            physioId: p._id,
            date: { $gte: startRange, $lte: endRange },
            status: { $in: ["Approved", "Paid", "Pending"] }, // include Pending
          },
        },
        { $group: { _id: null, total: { $sum: "$finalDailyKms" } } },
      ]);
      const totalKms = petrolAgg[0]?.total || 0;

      // 2. Calculate Completed Sessions Count
      const sessionAgg = await Session.aggregate([
        {
          $match: {
            physioId: p._id,
            sessionDate: { $gte: startRange, $lte: endRange },
            sessionStatusId: new mongoose.Types.ObjectId(
              "691ec69eae0e10763c8f21e0",
            ),
          },
        },
        { $group: { _id: null, count: { $sum: 1 } } },
      ]);
      const completedSessions = sessionAgg[0]?.count || 0;
      // 2B. Calculate Working Days (distinct session dates)
      // Distinct session dates with Pass Completed
      // 2B. Calculate Working Days including Paid Leaves
      // Distinct session dates with Pass Completed
      const workingdayAgg = await Session.aggregate([
        {
          $match: {
            physioId: p._id,
            sessionDate: { $gte: startRange, $lte: endRange },
            sessionStatusId: new mongoose.Types.ObjectId(
              "691ec69eae0e10763c8f21e0",
            ),
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$sessionDate",
              },
            },
          },
        },
        { $count: "days" },
      ]);
      let workingDays = workingdayAgg[0]?.days || 0;
      const totalWorkingdayAgg = await Session.aggregate([
        {
          $match: {
            sessionDate: { $gte: startRange, $lte: endRange },
            sessionStatusId: new mongoose.Types.ObjectId(
              "691ec69eae0e10763c8f21e0",
            ),
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$sessionDate",
              },
            },
          },
        },
        { $count: "days" },
      ]);
      let totalworkingDays = totalWorkingdayAgg[0]?.days || 0;

      // Add Paid Leave days
      const paidLeaveCount = await LeaveModel.countDocuments({
        physioId: p._id,
        LeaveDate: { $gte: startRange, $lte: endRange },
        PaidLeave: true,
        isActive: true,
      });
      workingDays += paidLeaveCount;
      // 3. Calculate Unpaid Leaves
      const leavesCount = await LeaveModel.countDocuments({
        physioId: p._id,
        LeaveDate: { $gte: startRange, $lte: endRange },
        PaidLeave: false,
        isActive: true,
      });

      // 4. Salary Calculations
      const baseSalary = Number(p.physioSalary || 0);
      const vehicleMaintenance = Number(p.physioVehicleMTC || 0);
      const incentivePerSession = Number(p.physioIncentive || 0);
      const petrolRatePerKm = Number(p.physioPetrolAlw || 0);
      // Salary per day
      const salaryPerDay = baseSalary / 30;

      // Deduction only for unpaid leaves
      const deductionAmount = Math.round(salaryPerDay * leavesCount);

      // Total salary includes working days (sessions + paid leave)
      const salaryFromWorkingDays = Math.round(salaryPerDay * workingDays);

      const grossSalary =
        salaryFromWorkingDays +
        vehicleMaintenance +
        incentivePerSession * completedSessions +
        totalKms * petrolRatePerKm;

      const netSalary = grossSalary - deductionAmount;
      // 5. Upsert Payroll Record
      await Payroll.findOneAndUpdate(
        {
          physioId: p._id,
          payrRollMonth: payrollMonth,
          payrRollYear: payrollYear,
        },
        {
          payRollDate: today,

          // SAVE SALARY DETAILS
          basicSalary: baseSalary,
          vehicleMaintanance: vehicleMaintenance,
          amountperKm: petrolRatePerKm,
          Incentive: incentivePerSession,

          PetrolKm: totalKms,
          PetrolAmount: totalKms * petrolRatePerKm,

          TotalSalary: Math.round(grossSalary),
          NetSalary: Math.round(netSalary),

          NoofLeave: leavesCount,
          TotalAmountDeducted: deductionAmount,

          payrRollCompletedSessions: completedSessions,
          totalWorkingDays: totalworkingDays,
          attendedDays: workingDays,
          calculationCycle: `${startRange.toDateString()} to ${endRange.toDateString()}`,
        },
        { upsert: true, new: true },
      );

      console.log(
        `[Payroll] Processed: ${p.physioName || p._id} | Net: ${Math.round(netSalary)}`,
      );

      // 6. Update Pending Petrol Allowances to Paid
      await PetrolAllowance.updateMany(
        {
          physioId: p._id,
          date: { $gte: startRange, $lte: endRange },
          status: "Pending",
        },
        { $set: { status: "Paid" } },
      );
    }

    console.log(`[Payroll] Monthly processing finished successfully.`);
  } catch (err) {
    console.error("Critical Payroll Error:", err);
  }
};
exports.initDailySessionGeneration = () =>
  cron.schedule("00 5 * * 1-6", () => this.processDailySessionGeneration(), {
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
  cron.schedule("0 20 28-31 * *", () => this.processMonthlyBilling(), {
    // cron.schedule("59 18 26 * *", () => this.processMonthlyBilling(), {
    // cron.schedule("39 11 23 * *", () => this.processMonthlyBilling(), {
    timezone: "Asia/Kolkata",
  });
exports.initMonthlyPayrollCron = () =>
  // cron.schedule("34 13 * * *", () => this.processMonthlyPayroll(), {
  cron.schedule("30 9 28-31 * *", () => this.processMonthlyPayroll(), {
    timezone: "Asia/Kolkata",
  });
