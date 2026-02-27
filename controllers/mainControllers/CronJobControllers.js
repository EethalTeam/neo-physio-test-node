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
const moment = require("moment-timezone");
const FeesType = require("../../model/masterModels/FeesType");
const Debit = require("../../model/masterModels/DebitPayment");
const Credit = require("../../model/masterModels/CreditPayment");

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
  console.log(
    `Attempting to broadcast "${type}" to ${admins.length} admins...`,
  );
  for (const admin of admins) {
    try {
      const newNotif = await Notification.create({
        toEmployeeId: admin._id,
        message,
        type,
        status: "unseen",
        meta,
      });

      console.log(
        `✅ Notification created in DB for Admin: ${admin.physioName} (ID: ${newNotif._id})`,
      );

      if (io) {
        io.to(admin._id.toString()).emit("receiveNotification", message);
        console.log(`📡 Socket emitted to room: ${admin._id}`);
      }
    } catch (err) {
      console.error(
        `❌ Failed to create notification for admin ${admin._id}:`,
        err.message,
      );
    }
  }
}

exports.initSessionCron = (io) => {
  cron.schedule(
    "0 20 * * 1-6",
    async () => {
      try {
        console.log("--- CRON START: 8 PM Pending Check ---");
        const { start, end } = getISTDateRange();
        console.log(
          `Checking range: ${start.toISOString()} to ${end.toISOString()}`,
        );

        const sessionCompletedId = new mongoose.Types.ObjectId(
          "691ec69eae0e10763c8f21e0",
        );
        const sessionCancelledId = new mongoose.Types.ObjectId(
          "692585f037162b40bd30a1ef",
        );
        const reviewCompletedId = new mongoose.Types.ObjectId(
          "694f85db081ee43cab2d4c8f",
        );

        const roles = await RoleBased.find({
          RoleName: { $in: ["Admin", "SuperAdmin", "HOD"] },
        });
        const roleIds = roles.map((r) => r._id);
        const admins = await Physio.find({
          roleId: { $in: roleIds },
          isActive: true,
        });

        if (admins.length === 0) {
          console.log("⚠️ No active Admins/HODs found in DB. Stopping.");
          return;
        }
        console.log(
          `Found ${admins.length} eligible admins: ${admins.map((a) => a.physioName).join(", ")}`,
        );

        const pendingSessions = await Session.find({
          sessionDate: { $gte: start, $lte: end },
          sessionStatusId: { $nin: [sessionCompletedId, sessionCancelledId] },
        })
          .populate("patientId", "patientName")
          .populate("physioId", "physioName");

        console.log(`📊 Pending Sessions Found: ${pendingSessions.length}`);

        const pendingReviews = await Review.find({
          reviewDate: { $gte: start, $lte: end },
          reviewStatusId: { $ne: reviewCompletedId },
        })
          .populate("patientId", "patientName")
          .populate("physioId", "physioName");

        console.log(`📊 Pending Reviews Found: ${pendingReviews.length}`);

        for (const sess of pendingSessions) {
          const pName = sess.patientId?.patientName || "N/A";
          const phName = sess.physioId?.physioName || "N/A";
          const msg = `Physio - ${phName} didn't complete the sessions today, the pending session for the patient - ${pName}`;
          await broadcastNotification(
            admins,
            msg,
            "Session-Update",
            { SessionId: sess._id, PatientId: sess.patientId?._id },
            io,
          );
        }

        for (const rev of pendingReviews) {
          const pName = rev.patientId?.patientName || "N/A";
          const phName = rev.physioId?.physioName || "N/A";
          const msg = `( ${phName}'s) Red-Flags review today for patient - ${pName} is Pending`;
          await broadcastNotification(
            admins,
            msg,
            "Pending-Review",
            { ReviewId: rev._id, PatientId: rev.patientId?._id },
            io,
          );
        }

        console.log("--- CRON FINISHED ---");
      } catch (error) {
        console.error("💥 CRON FATAL ERROR:", error);
      }
    },
    { timezone: "Asia/Kolkata" },
  );
};

exports.initMonthlyBillingGeneration = (io) => {
  cron.schedule(
    // "31 12 26 2 *",
    "0 8 28-31 * *",

    async () => {
      console.log("🔔 Monthly Billing Cron Triggered...");
      const today = new Date();
      const lastDayOfMonth = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0,
      ).getDate();

      try {
        console.log("💳 Starting Monthly Bill Generation...");
        const completedStatusId = new mongoose.Types.ObjectId(
          "691ec69eae0e10763c8f21e0",
        );
        const startOfMonth = new Date(
          today.getFullYear(),
          today.getMonth(),
          1,
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
        );

        const billingData = await Session.aggregate([
          {
            $match: {
              sessionStatusId: completedStatusId,
              sessionDate: { $gte: startOfMonth, $lte: endOfMonth },
              isBilled: false,
            },
          },
          {
            $group: {
              _id: "$patientId",
              sessionCount: { $sum: 1 },
              sessions: { $push: "$_id" },
              physioId: { $first: "$physioId" },
            },
          },
        ]);

        for (const item of billingData) {
          const patient = await Patient.findById(item._id).populate(
            "FeesTypeId",
          );
          if (!patient) continue;

          const feesTypeLabel = patient.FeesTypeId?.feesTypeName;
          if (feesTypeLabel === "PerMonth") continue;

          const rate = patient.feeAmount || 0;
          const totalBilledAmount = rate * item.sessionCount; // Total before any deduction

          // --- ADVANCE CALCULATION LOGIC ---

          // 1. Get total advance ever paid by patient
          const totalAdvancePaid = await Debit.aggregate([
            { $match: { patientId: item._id } },
            { $group: { _id: null, total: { $sum: "$DebitAmount" } } },
          ]);
          const totalAdvance =
            totalAdvancePaid.length > 0 ? totalAdvancePaid[0].total : 0;

          // 2. Get total amount already deducted from previous bills
          const totalAlreadyDeducted = await Bill.aggregate([
            { $match: { patientId: item._id } },
            { $group: { _id: null, total: { $sum: "$DeductedFromAdvance" } } },
          ]);
          const usedAdvance =
            totalAlreadyDeducted.length > 0 ? totalAlreadyDeducted[0].total : 0;

          // 3. Available Advance
          let availableAdvance = totalAdvance - usedAdvance;
          let deductedFromAdvance = 0;

          if (availableAdvance > 0) {
            // If advance covers full bill or part of it
            deductedFromAdvance = Math.min(availableAdvance, totalBilledAmount);
          }

          const netBilledAmount = totalBilledAmount - deductedFromAdvance;

          // Determine Payment Status based on Net Amount
          let paymentStatus = "Pending";
          // if (netBilledAmount === 0 && totalBilledAmount > 0) {
          //   paymentStatus = "Paid"; // Fully covered by advance
          // } else if (deductedFromAdvance > 0) {
          //   paymentStatus = "Partially Paid"; // Partially covered by advance
          // }

          // --- CREATE THE BILL ---
          await Bill.create({
            patientId: item._id,
            physioId: patient.physioId,
            paymentStatus: paymentStatus,
            ReceivedAmount: deductedFromAdvance, // Amount "received" via advance
            TotalBilledAmount: totalBilledAmount,
            DeductedFromAdvance: deductedFromAdvance,
            NetBilledAmount: netBilledAmount,
            startDate: startOfMonth,
            ToDate: endOfMonth,
            ratePerSession: rate,
            month: today.toLocaleString("default", { month: "long" }),
            year: today.getFullYear(),
            TotalSessionCount: item.sessionCount,
          });

          await Session.updateMany(
            { _id: { $in: item.sessions } },
            { $set: { isBilled: true } },
          );

          console.log(
            `✅ Generated: ${patient.patientName} | Net: ₹${netBilledAmount} (Adv: ₹${deductedFromAdvance})`,
          );
        }

        console.log(`✅ Billing process finished.`);
      } catch (error) {
        console.error("❌ Error in Monthly Billing Job:", error);
      }
    },
    { timezone: "Asia/Kolkata" },
  );
};

exports.initDailySessionGeneration = () => {
  cron.schedule(
    "0 5 * * 1-6",
    async () => {
      try {
        console.log("🚀 Starting Daily Session Generation (5 AM IST)...");
        const { start, end } = getISTDateRange();
        const completedStatusId = "691ec69eae0e10763c8f21e0";
        const pendingStatusId = "691ecb36b87c5c57dead47a7";

        // 1. Fetch all active patients
        const activePatients = await Patient.find({
          isRecovered: false,
          sessionStartDate: { $lte: end },
        }).sort({ visitOrder: 1 });

        for (const patient of activePatients) {
          // 2. Check if session already exists for today
          const exists = await Session.findOne({
            patientId: patient._id,
            sessionDate: { $gte: start, $lte: end },
          });

          if (exists) continue;

          // --- LEAVE & REASSIGNMENT LOGIC START ---
          let finalPhysioId = patient.physioId;
          let finalSessionTime = patient.sessionTime;

          // Check if the assigned physio is on leave today
          const leaveRecord = await LeaveModel.findOne({
            physioId: patient.physioId,
            LeaveDate: { $gte: start, $lte: end },
            isActive: true,
          });

          if (leaveRecord && leaveRecord.SessionGenerateForLeave) {
            // Find if this specific patient is reassigned in the leave record
            const reassignmentData = leaveRecord.SessionGenerateForLeave.find(
              (item) => item.patientId.toString() === patient._id.toString(),
            );

            if (reassignmentData && reassignmentData.Re_Assign) {
              finalPhysioId = reassignmentData.Re_Assign;
              // If a specific time was set during reassignment, use it; otherwise use patient's default
              finalSessionTime =
                reassignmentData.sessionTime || patient.sessionTime;

              console.log(
                `Reassigning Patient ${patient._id} from ${patient.physioId} to ${finalPhysioId}`,
              );
            }
          }
          // --- LEAVE & REASSIGNMENT LOGIC END ---

          // 3. Increment Session Code Counter
          const counter = await Counter.findOneAndUpdate(
            { _id: "sessionCode" },
            { $inc: { seq: 1 } },
            { new: true, upsert: true },
          );

          const formattedCode = `SESS-${String(counter.seq).padStart(6, "0")}`;

          // 4. Calculate Session Count
          const completedCount = await Session.countDocuments({
            patientId: patient._id,
            sessionStatusId: completedStatusId,
          });

          const currentSessionCount = completedCount + 1;

          // 5. Create the Session
          await Session.create({
            sessionCode: formattedCode,
            patientId: patient._id,
            physioId: finalPhysioId, // Uses reassigned ID if on leave
            sessionDate: start,
            sessionDay: start.toLocaleDateString("en-IN", { weekday: "long" }),
            sessionTime: finalSessionTime, // Uses reassigned time if on leave
            targetArea: patient.targetedArea,
            sessionStatusId: pendingStatusId,
            sessionCount: currentSessionCount,
            modeOfExercise: "General",
          });
        }
        console.log(`[5AM Cron] Daily session records generated successfully.`);
      } catch (error) {
        console.error("Error in 5AM Generation Job:", error);
      }
    },
    { timezone: "Asia/Kolkata" },
  );
};

exports.initScheduledReviewGeneration = () => {
  cron.schedule(
    "0 5 * * 1-6",
    async () => {
      try {
        console.log(
          "🚀 Starting Scheduled Review Generation (Strict ISO UTC Fix)...",
        );

        const [reviewTypeDefault, reviewStatusPending] = await Promise.all([
          ReviewType.findOne({ reviewTypeName: "General" }),
          ReviewStatus.findOne({ reviewStatusName: "Pending" }),
        ]);

        // 1. Get Today and Tomorrow in IST format, but as strings
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const todayIST = new Date(now.getTime() + istOffset);
        const todayStr = todayIST.toISOString().split("T")[0]; // "2026-02-09"

        const tomorrowIST = new Date(todayIST.getTime() + 24 * 60 * 60 * 1000);
        const tomorrowStr = tomorrowIST.toISOString().split("T")[0]; // "2026-02-10"

        const activePatients = await Patient.find({ isRecovered: false });

        for (const patient of activePatients) {
          if (!patient.reviewFrequency || !patient.sessionStartDate) continue;

          const lastReview = await Review.findOne({
            patientId: patient._id,
          }).sort({ reviewDate: -1 });

          // Determine the base day (stripping any existing time)
          let baseDate = lastReview
            ? lastReview.reviewDate
            : patient.sessionStartDate;
          let baseDateStr = new Date(baseDate).toISOString().split("T")[0];

          let calculationDate = new Date(baseDateStr + "T00:00:00.000Z");
          calculationDate.setUTCDate(
            calculationDate.getUTCDate() + patient.reviewFrequency,
          );

          // Sunday Handling
          if (calculationDate.getUTCDay() === 0) {
            calculationDate.setUTCDate(calculationDate.getUTCDate() + 1);
          }

          const nextDueStr = calculationDate.toISOString().split("T")[0];

          // 2. Comparison against IST Strings
          if (nextDueStr === todayStr || nextDueStr === tomorrowStr) {
            // 3. FORCE UTC MIDNIGHT STRING
            // This is the specific fix to prevent the 18:30:00 shift
            const finalISODate = nextDueStr + "T00:00:00.000Z";

            const alreadyExists = await Review.findOne({
              patientId: patient._id,
              reviewDate: new Date(finalISODate),
            });

            if (!alreadyExists) {
              await Review.create({
                patientId: patient._id,
                physioId: patient.physioId,
                reviewDate: finalISODate, // Mongoose accepts the string and stores it exactly
                reviewStatusId: reviewStatusPending._id,
                reviewTypeId: reviewTypeDefault._id,
              });
              console.log(
                `✅ Fixed Save for ${patient.patientName}: ${finalISODate}`,
              );
            }
          }
        }
        console.log("[6AM Cron] Review generation complete.");
      } catch (error) {
        console.error("❌ Cron Error:", error);
      }
    },
    { timezone: "Asia/Kolkata" },
  );
};

exports.initReturnJourneyAllowanceCron = () => {
  cron.schedule(
    "30 19 * * *",
    async () => {
      try {
        console.log(
          "🚀 Starting Return Journey Petrol Allowance Calculation (7:30 PM IST)...",
        );

        const completedStatus = await SessionStatus.findOne({
          sessionStatusName: "Completed",
        });
        if (!completedStatus)
          return console.error("❌ 'Completed' status not found");

        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        const allowanceDate = new Date();
        allowanceDate.setHours(12, 0, 0, 0);

        const completedSessions = await Session.find({
          sessionDate: { $gte: start, $lte: end },
          sessionStatusId: completedStatus._id,
        })
          .populate("patientId")
          .sort({ sessionToTime: 1 });

        if (!completedSessions.length)
          return console.log("ℹ️ No completed sessions today");

        // Group by physio
        const physioReturnKms = {};

        completedSessions.forEach((session) => {
          const physioId = session.physioId.toString();
          const patientData = session.patientId;

          if (!patientData || patientData.KmsfLPatienttoHub <= 0) return;

          // Initialize
          if (!physioReturnKms[physioId]) physioReturnKms[physioId] = 0;

          // Add return kms only for completed sessions
          physioReturnKms[physioId] += patientData.KmsfLPatienttoHub;
        });

        // Update PetrolAllowance collection
        const updatePromises = Object.entries(physioReturnKms).map(
          async ([physioId, totalReturnKms]) => {
            await PetrolAllowance.findOneAndUpdate(
              { physioId, date: allowanceDate },
              {
                $inc: {
                  completedKms: totalReturnKms,
                  finalDailyKms: totalReturnKms,
                },
              },
              { new: true, upsert: true },
            );

            console.log(
              `✅ Added ${totalReturnKms} km return journey for Physio ID: ${physioId}`,
            );
          },
        );

        await Promise.all(updatePromises);
        console.log("🏁 Return Journey Allowance calculation complete.");
      } catch (error) {
        console.error("❌ Error in Return Journey Cron:", error);
      }
    },
    { timezone: "Asia/Kolkata" },
  );
};

exports.initMonthlyPayrollCron = () => {
  cron.schedule(
    "30 9 28-31 * *",

    // "44 15 * * *",
    async () => {
      try {
        const today = new Date();

        const startRange = new Date(
          today.getFullYear(),
          today.getMonth() - 1,
          20,
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
        );

        const monthName = today.toLocaleString("default", { month: "long" });
        const year = today.getFullYear();

        // console.log(`\n====================================================`);
        // console.log(`🚀 PAYROLL DEBUG SESSION: ${monthName} ${year}`);
        // console.log(`📅 Cycle: ${startRange.toISOString()} TO ${endRange.toISOString()}`);
        // console.log(`====================================================\n`);

        const COMPLETED_STATUS_ID = "691ec69eae0e10763c8f21e0";
        const CANCELLED_STATUS_ID = "691ecb36b87c5c57dead47a7";

        const physios = await Physio.find({ isActive: true });

        for (const physio of physios) {
          // console.log(`\n👤 PHYSIO: ${physio.physioName} [${physio._id}]`);

          const rawPetrolRecords = await PetrolAllowance.find({
            physioId: physio._id,
            date: { $gte: startRange, $lte: endRange },
          }).lean();

          // console.log(`--- ⛽ RAW PETROL DATA CHECK ---`);
          if (rawPetrolRecords.length === 0) {
            // console.log(`⚠️  No Petrol records found at all for this date range.`);
          } else {
            let debugTotalKm = 0;
            rawPetrolRecords.forEach((rec, index) => {
              debugTotalKm += rec.finalDailyKms || 0;
              // console.log(
              //   `[${index + 1}] Date: ${rec.date.toISOString().split('T')[0]} | ` +
              //   `Kms: ${rec.finalDailyKms} | ` +
              //   `Status: ${rec.status} | ` +
              //   `Approved: ${rec.status === "Approved" || rec.status === "Paid" ? "YES" : "NO"}`
              // );
            });
            // console.log(`Total Kms in DB (Regardless of Status): ${debugTotalKm} km`);
          }

          // --- 3. ACTUAL AGGREGATION (Used for Payroll) ---
          const petrolStats = await PetrolAllowance.aggregate([
            {
              $match: {
                physioId: physio._id,
                date: { $gte: startRange, $lte: endRange },
                // Loophole Check: If your records are 'Pending', this match fails.
                status: { $in: ["Approved", "Paid"] },
              },
            },
            {
              $group: {
                _id: null,
                totalKm: { $sum: "$finalDailyKms" },
              },
            },
          ]);

          const totalKm = petrolStats[0]?.totalKm || 0;
          const amountPerKm = physio.physioPetrolAlw || 0;
          const totalPetrolAmount = totalKm * amountPerKm;

          // console.log(`📊 Aggregation Result (Approved Only): ${totalKm} km`);
          // console.log(`💰 Petrol Calculation: ${totalKm} * ₹${amountPerKm} = ₹${totalPetrolAmount}`);

          // --- 4. SESSIONS & LEAVES ---
          const sessionStats = await Session.aggregate([
            {
              $match: {
                physioId: physio._id,
                sessionDate: { $gte: startRange, $lte: endRange },
              },
            },
            {
              $group: {
                _id: null,
                completed: {
                  $sum: {
                    $cond: [
                      {
                        $eq: [
                          "$sessionStatusId",
                          new mongoose.Types.ObjectId(COMPLETED_STATUS_ID),
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                cancelled: {
                  $sum: {
                    $cond: [
                      {
                        $eq: [
                          "$sessionStatusId",
                          new mongoose.Types.ObjectId(CANCELLED_STATUS_ID),
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ]);

          const completedCount = sessionStats[0]?.completed || 0;
          const unpaidLeaveDays = await LeaveModel.countDocuments({
            physioId: physio._id,
            LeaveDate: { $gte: startRange, $lte: endRange },
            PaidLeave: false,
            isActive: true,
          });

          // --- 5. SALARY CALCULATIONS ---
          const basicSalary = physio.physioSalary || 0;
          const perDaySalary = basicSalary / 30; // Fixed 30 days logic
          const totalAmountDeducted = Math.round(
            perDaySalary * unpaidLeaveDays,
          );
          const maintenance = physio.physioVehicleMTC || 0;
          const incentiveTotal = (physio.physioIncentive || 0) * completedCount;

          const totalGrossSalary =
            basicSalary + maintenance + incentiveTotal + totalPetrolAmount;
          const netSalary = totalGrossSalary - totalAmountDeducted;

          // --- 6. UPSERT PAYROLL ---
          await Payroll.findOneAndUpdate(
            {
              physioId: physio._id,
              payrRollMonth: monthName,
              payrRollYear: year,
            },
            {
              payRollDate: today,
              payrRollCompletedSessions: completedCount,
              payrRollCancelledSession: sessionStats[0]?.cancelled || 0,
              PetrolKm: totalKm,
              PetrolAmount: Math.round(totalPetrolAmount),
              basicSalary: basicSalary,
              vehicleMaintanance: maintenance,
              Incentive: incentiveTotal,
              amountperKm: amountPerKm,
              NoofLeave: unpaidLeaveDays,
              TotalAmountDeducted: totalAmountDeducted,
              TotalSalary: Math.round(totalGrossSalary),
              NetSalary: Math.round(netSalary),
              payrollCycleStart: startRange,
              payrollCycleEnd: endRange,
            },
            { upsert: true, new: true },
          );
        }
        console.log(`\n✅ Payroll Debug Session Finished.`);
      } catch (error) {
        console.error("❌ Payroll Cron Error:", error);
      }
    },
    { timezone: "Asia/Kolkata" },
  );
};
