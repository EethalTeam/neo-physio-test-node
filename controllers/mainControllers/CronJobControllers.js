const cron = require("node-cron");
const mongoose = require("mongoose");
const Session = require("../../model/masterModels/Session");
const Review = require("../../model/masterModels/Review");
const Patient = require("../../model/masterModels/Patient");
const Notification = require("../../model/masterModels/Notification");
const SessionStatus = require("../models/SessionStatus");
const PetrolAllowance = require("../models/PetrolAllowance");
const Physio = require("../../model/masterModels/Physio");
const RoleBased = require("../../model/masterModels/RBAC");
const Counter = require("../../model/masterModels/Counter");

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
          const msg = `Physio - ${phName} has a pending review today for patient - ${pName}`;
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

          if (
            patient.totalSessionDays &&
            currentSessionCount > patient.totalSessionDays
          )
            continue;

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
    "30 5 * * 1-6", 
    async () => {
      try {
        console.log("🚀 Starting Scheduled Review Generation (6 AM IST)...");

        const [reviewTypeDefault, reviewStatusPending] = await Promise.all([
          ReviewType.findOne({ reviewTypeName: "General" }),
          ReviewStatus.findOne({ reviewStatusName: "Pending" }),
        ]);

        if (!reviewTypeDefault || !reviewStatusPending) {
          console.error("❌ Review Type or Status defaults not found.");
          return;
        }

        const now = new Date();
        const todayStr = now.toLocaleDateString('en-CA'); 
        
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        const tomorrowStr = tomorrow.toLocaleDateString('en-CA');

        const activePatients = await Patient.find({
          isRecovered: false,
          reviewFrequency: { $exists: true, $gt: 0 },
          sessionStartDate: { $exists: true, $lte: tomorrow },
        });

        for (const patient of activePatients) {
          const lastReview = await Review.findOne({ patientId: patient._id })
            .sort({ reviewDate: -1 });

          let nextReviewDueDate;if (lastReview) {
            const lastDate = new Date(lastReview.reviewDate);
            nextReviewDueDate = new Date(lastDate);
            nextReviewDueDate.setDate(lastDate.getDate() + patient.reviewFrequency);
          } else {
            const startDate = new Date(patient.sessionStartDate);
            nextReviewDueDate = new Date(startDate);
            nextReviewDueDate.setDate(startDate.getDate() + patient.reviewFrequency);
          }
          if (nextReviewDueDate.getDay() === 0) {
            nextReviewDueDate.setDate(nextReviewDueDate.getDate() + 1);
            console.log(`📅 Sunday detected for ${patient.patientName}. Moving to Monday.`);
          }
          

          const dueDateStr = nextReviewDueDate.toLocaleDateString('en-CA');

          if (dueDateStr === todayStr || dueDateStr === tomorrowStr) {
            const alreadyExists = await Review.findOne({
              patientId: patient._id,
              reviewDate: nextReviewDueDate
            });

            if (!alreadyExists) {
              await Review.create({
                patientId: patient._id,
                physioId: patient.physioId,
                reviewDate: nextReviewDueDate,
                reviewStatusId: reviewStatusPending._id,
                reviewTypeId: reviewTypeDefault._id,
              });
              console.log(`✅ Review generated for ${patient.patientName} on ${dueDateStr}`);
            }
          }
        }
        console.log("[6AM Cron] Review generation cycle complete.");
      } catch (error) {
        console.error("❌ Error in 6AM Review Generation Job:", error);
      }
    },
    { timezone: "Asia/Kolkata" }
  );
};

exports.initReturnJourneyAllowanceCron = () => {
  
  cron.schedule(
    "30 21 * * *",
    async () => {
      try {
        console.log("🚀 Starting Return Journey Petrol Allowance Calculation (7:30 PM IST)...");

        
        const completedStatus = await SessionStatus.findOne({ sessionStatusName: "Completed" });
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

        
        const updatePromises = Object.values(latestSessionByPhysio).map(async (lastSession) => {
          const patientData = lastSession.patientId;

          if (patientData && patientData.KmsfLPatienttoHub > 0) {
            const returnKms = patientData.KmsfLPatienttoHub;

            await PetrolAllowance.findOneAndUpdate(
              { 
                physioId: lastSession.physioId, 
                date: allowanceDate 
              },
              {
                $inc: {
                  completedKms: returnKms,
                  finalDailyKms: returnKms,
                },
              },
              { new: true, upsert: true }
            );

            console.log(
              `✅ Added ${returnKms}km return journey for Physio ID: ${lastSession.physioId} (Patient: ${patientData.patientName})`
            );
          }
        });

        await Promise.all(updatePromises);
        console.log("🏁 Return Journey Allowance calculation complete.");
      } catch (error) {
        console.error("❌ Error in Return Journey Cron:", error);
      }
    },
    { timezone: "Asia/Kolkata" }
  );
};