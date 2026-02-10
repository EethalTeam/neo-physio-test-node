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
const moment = require("moment-timezone");

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

exports.initDailySessionGeneration = () => {
  cron.schedule(
    "0 5 * * 1-6",
    async () => {
      try {
        console.log("🚀 Starting Daily Session Generation (5 AM IST)...");
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

          const counter = await Counter.findOneAndUpdate(
            { _id: "sessionCode" },
            { $inc: { seq: 1 } },
            { new: true, upsert: true },
          );

          const formattedCode = `SESS-${String(counter.seq).padStart(6, "0")}`;
          const completedCount = await Session.countDocuments({
            patientId: patient._id,
            sessionStatusId: completedStatusId,
          });

          const currentSessionCount = completedCount + 1;

          // if (
          //   patient.totalSessionDays &&
          //   currentSessionCount > patient.totalSessionDays
          // )
          //   continue;s

          await Session.create({
            sessionCode: formattedCode,
            patientId: patient._id,
            physioId: patient.physioId,
            sessionDate: start,
            sessionDay: start.toLocaleDateString("en-IN", { weekday: "long" }),
            sessionTime: patient.sessionTime,
            targetArea: patient.targetedArea,
            sessionStatusId: pendingStatusId,
            sessionCount: currentSessionCount,
            modeOfExercise: "General",
          });
        }
        console.log(`[5AM Cron] Daily session records generated.`);
      } catch (error) {
        console.error("Error in 5AM Generation Job:", error);
      }
    },
    { timezone: "Asia/Kolkata" },
  );
};

exports.initScheduledReviewGeneration = () => {
  cron.schedule(
    "37 13 * * 1-6",
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
    "30 21 * * *",
    async () => {
      try {
        console.log(
          "🚀 Starting Return Journey Petrol Allowance Calculation (7:30 PM IST)...",
        );

        const completedStatus = await SessionStatus.findOne({
          sessionStatusName: "Completed",
        });
        if (!completedStatus) {
          console.error("❌ 'Completed' status not found in database.");
          return;
        }

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

        if (completedSessions.length === 0) {
          console.log("ℹ️ No completed sessions found for today.");
          return;
        }

        const latestSessionByPhysio = {};

        completedSessions.forEach((session) => {
          latestSessionByPhysio[session.physioId.toString()] = session;
        });

        const updatePromises = Object.values(latestSessionByPhysio).map(
          async (lastSession) => {
            const patientData = lastSession.patientId;

            if (patientData && patientData.KmsfLPatienttoHub > 0) {
              const returnKms = patientData.KmsfLPatienttoHub;

              await PetrolAllowance.findOneAndUpdate(
                {
                  physioId: lastSession.physioId,
                  date: allowanceDate,
                },
                {
                  $inc: {
                    completedKms: returnKms,
                    finalDailyKms: returnKms,
                  },
                },
                { new: true, upsert: true },
              );

              console.log(
                `✅ Added ${returnKms}km return journey for Physio ID: ${lastSession.physioId} (Patient: ${patientData.patientName})`,
              );
            }
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
