const cron = require('node-cron');
const mongoose = require('mongoose');
const Session = require('../../model/masterModels/Session');
const Review = require('../../model/masterModels/Review');
const Patient = require('../../model/masterModels/Patient');
const Notification = require('../../model/masterModels/Notification');
const Physio = require('../../model/masterModels/Physio');
const RoleBased = require('../../model/masterModels/RBAC');
const Counter = require('../../model/masterModels/Counter'); 

const getISTDateRange = () => {
    const now = new Date();
    const offset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + offset);
    const start = new Date(Date.UTC(istNow.getFullYear(), istNow.getMonth(), istNow.getDate()));
    const end = new Date(Date.UTC(istNow.getFullYear(), istNow.getMonth(), istNow.getDate(), 23, 59, 59, 999));
    return { start, end };
};

async function broadcastNotification(admins, message, type, meta, io) {
    console.log(`Attempting to broadcast "${type}" to ${admins.length} admins...`);
    for (const admin of admins) {
        try {
            const newNotif = await Notification.create({
                toEmployeeId: admin._id,
                message,
                type,
                status: 'unseen', 
                meta
            });

            console.log(`✅ Notification created in DB for Admin: ${admin.physioName} (ID: ${newNotif._id})`);

            if (io) {
                io.to(admin._id.toString()).emit("receiveNotification", message);
                console.log(`📡 Socket emitted to room: ${admin._id}`);
            }
        } catch (err) {
            console.error(`❌ Failed to create notification for admin ${admin._id}:`, err.message);
        }
    }
}

exports.initSessionCron = (io) => {
    // Note: Kept your specific test time '17 20' (8:17 PM)
    cron.schedule('0 20 * * 1-6', async () => {
        try {
            console.log('--- CRON START: 8 PM Pending Check ---');
            const { start, end } = getISTDateRange();
            console.log(`Checking range: ${start.toISOString()} to ${end.toISOString()}`);

            const sessionCompletedId = new mongoose.Types.ObjectId("691ec69eae0e10763c8f21e0");
            const sessionCancelledId = new mongoose.Types.ObjectId("692585f037162b40bd30a1ef");
            const reviewCompletedId = new mongoose.Types.ObjectId("694f85db081ee43cab2d4c8f"); 

            // 1. Get Admins
            const roles = await RoleBased.find({ RoleName: { $in: ['Admin', 'SuperAdmin', 'HOD'] } });
            const roleIds = roles.map(r => r._id);
            const admins = await Physio.find({ roleId: { $in: roleIds }, isActive: true });
            
            if (admins.length === 0) {
                console.log('⚠️ No active Admins/HODs found in DB. Stopping.');
                return;
            }
            console.log(`Found ${admins.length} eligible admins: ${admins.map(a => a.physioName).join(', ')}`);

            // 2. Query Pending Sessions
            const pendingSessions = await Session.find({
                sessionDate: { $gte: start, $lte: end },
                sessionStatusId: { $nin: [sessionCompletedId, sessionCancelledId] }
            }).populate('patientId', 'patientName').populate('physioId', 'physioName');

            console.log(`📊 Pending Sessions Found: ${pendingSessions.length}`);

            // 3. Query Pending Reviews
            const pendingReviews = await Review.find({
                reviewDate: { $gte: start, $lte: end },
                reviewStatusId: { $ne: reviewCompletedId }
            }).populate('patientId', 'patientName').populate('physioId', 'physioName');

            console.log(`📊 Pending Reviews Found: ${pendingReviews.length}`);

            // 4. Process Sessions
            for (const sess of pendingSessions) {
                const pName = sess.patientId?.patientName || 'N/A';
                const phName = sess.physioId?.physioName || 'N/A';
                const msg = `Physio - ${phName} didn't complete the sessions today, the pending session for the patient - ${pName}`;
                await broadcastNotification(admins, msg, 'Session-Update', { SessionId: sess._id, PatientId: sess.patientId?._id }, io);
            }

            // 5. Process Reviews
            for (const rev of pendingReviews) {
                const pName = rev.patientId?.patientName || 'N/A';
                const phName = rev.physioId?.physioName || 'N/A';
                const msg = `Physio - ${phName} has a pending review today for patient - ${pName}`;
                await broadcastNotification(admins, msg, 'Pending-Review', { ReviewId: rev._id, PatientId: rev.patientId?._id }, io);
            }

            console.log('--- CRON FINISHED ---');
        } catch (error) {
            console.error('💥 CRON FATAL ERROR:', error);
        }
    }, { timezone: "Asia/Kolkata" });
};

// --- 5 AM: DAILY SESSION GENERATION ---
exports.initDailySessionGeneration = () => {
    // Logic remains the same, but ensure mongoose is at top of file
    cron.schedule('0 5 * * 1-6', async () => {
        try {
            console.log('🚀 Starting Daily Session Generation (5 AM IST)...');
            const { start, end } = getISTDateRange();
            const completedStatusId = "691ec69eae0e10763c8f21e0";
            const pendingStatusId = "691ecb36b87c5c57dead47a7"; 

            const activePatients = await Patient.find({
                isRecovered: false,
                sessionStartDate: { $lte: end }
            }).sort({ visitOrder: 1 });

            for (const patient of activePatients) {
                const exists = await Session.findOne({
                    patientId: patient._id,
                    sessionDate: { $gte: start, $lte: end }
                });

                if (exists) continue;

                const counter = await Counter.findOneAndUpdate(
                    { _id: "sessionCode" },
                    { $inc: { seq: 1 } },
                    { new: true, upsert: true }
                );

                const formattedCode = `SESS-${String(counter.seq).padStart(6, '0')}`;
                const completedCount = await Session.countDocuments({
                    patientId: patient._id,
                    sessionStatusId: completedStatusId
                });

                const currentSessionCount = completedCount + 1;

                if (patient.totalSessionDays && currentSessionCount > patient.totalSessionDays) continue;

                await Session.create({
                    sessionCode: formattedCode,
                    patientId: patient._id,
                    physioId: patient.physioId,
                    sessionDate: start,
                    sessionDay: start.toLocaleDateString('en-IN', { weekday: 'long' }),
                    sessionTime: patient.sessionTime,
                    targetArea: patient.targetedArea,
                    sessionStatusId: pendingStatusId,
                    sessionCount: currentSessionCount, 
                    modeOfExercise: "General"
                });
            }
            console.log(`[5AM Cron] Daily session records generated.`);
        } catch (error) {
            console.error('Error in 5AM Generation Job:', error);
        }
    }, { timezone: "Asia/Kolkata" });
};