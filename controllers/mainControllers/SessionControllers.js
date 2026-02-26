const mongoose = require("mongoose");
const Session = require("../../model/masterModels/Session");
const SessionStatus = require("../../model/masterModels/SessionStatus");
const Patient = require("../../model/masterModels/Patient");
const PetrolAllowance = require("../../model/masterModels/PetrolAllowance");
const Review = require("../../model/masterModels/Review");
const ReviewType = require("../../model/masterModels/ReviewType");
const ReviewStatus = require("../../model/masterModels/ReviewStatus");
const Employee = require("../../model/masterModels/Physio");
const RoleBased = require("../../model/masterModels/RBAC");
const Counter = require("../../model/masterModels/Counter");
const Notification = require("../../model/masterModels/Notification");
// Create a new Session
exports.createSession = async (req, res) => {
  try {
    const {
      patientId,
      physioId,
      sessionDates, 
      sessionTime,
      sessionFromTime,
      sessionToTime,
      machineId,
      sessionStatusId,
      sessionFeedbackPros,
      sessionFeedbackCons,
      modeOfExercise,
      redFlags,
      homeExerciseAssigned,
      modalitiesList,
      targetArea,
      media,
      modalities,
    } = req.body;

    const completedStatusId = "691ec69eae0e10763c8f21e0";
    const createdSessions = [];

    const baseCompletedCount = await Session.countDocuments({
      patientId: patientId,
      sessionStatusId: completedStatusId,
    });

    for (let i = 0; i < sessionDates.length; i++) {
      const dateStr = sessionDates[i];
      const currentDate = new Date(dateStr);

      const counter = await Counter.findOneAndUpdate(
        { _id: "sessionCode" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
      );

      const formattedCode = `SESS-${String(counter.seq).padStart(6, "0")}`;

      const currentSessionCount = baseCompletedCount + (i + 1);

      const session = new Session({
        sessionCode: formattedCode,
        patientId,
        physioId,
        sessionDate: currentDate,
        sessionDay: currentDate.toLocaleDateString("en-IN", { weekday: "long" }),
        sessionTime,
        sessionFromTime,
        sessionToTime,
        machineId,
        sessionStatusId,
        sessionFeedbackPros,
        sessionFeedbackCons,
        modeOfExercise,
        redFlags,
        homeExerciseAssigned,
        modalitiesList,
        targetArea,
        media,
        modalities,
        sessionCount: currentSessionCount,
      });

      const savedSession = await session.save();
      createdSessions.push(savedSession);
    }

    res.status(200).json({
      message: `${createdSessions.length} sessions created successfully`,
      data: createdSessions,
    });
  } catch (error) {
    console.error("Error creating sessions:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.resetAllSessionsBillingStatus = async (req, res) => {
  try {
    const result = await Session.updateMany({}, { $set: { isBilled: false } });

    return res.status(200).json({
      success: true,
      message: `Successfully reset billing status for ${result.modifiedCount} sessions.`,
    });
  } catch (error) {
    console.error("Error resetting all sessions:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// Get all Session
// exports.getAllSession = async (req, res) => {
//   try {
//     const { sessionDate, nextDate, physioId, storedRole } = req.body;
//     let filter = {};
//     if (sessionDate) {
//       filter.sessionDate = { $gte: sessionDate, $lt: nextDate };
//     }
//     if (
//       physioId &&
//       storedRole !== "SuperAdmin" &&
//       storedRole !== "Admin" &&
//       storedRole !== "HOD"
//     ) {
//       filter.physioId = physioId;
//     }

//     const session = await Session.find(filter)
//       .populate("physioId", "physioName")
//       .populate("modalitiesList.modalityId", "modalitiesName")
//       .populate("patientId", "patientName")
//       .populate("machineId", "machineName")
//       .populate(
//         "sessionStatusId",
//         "sessionStatusName sessionStatusColor sessionStatusTextColor",
//       )
//       .populate("redFlags.redFlagId", "redflagName");
//     if (!session) {
//       res.status(400).json({ message: "Session is not found" });
//     }

//     res.status(200).json(session);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

exports.getMonthlySummary = async (req, res) => {
  try {
    const { physioId, month, year } = req.body;

    if (!physioId || !month || !year) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const sessions = await Session.find({
      physioId: new mongoose.Types.ObjectId(physioId),
      sessionDate: { $gte: startDate, $lt: endDate },
    }).populate("sessionStatusId", "sessionStatusName");

    const summary = {
      totalSessions: sessions.length,
      completedSessions: sessions.filter(
        (s) => s.sessionStatusId?.sessionStatusName === "Completed",
      ).length,
      cancelledSessions: sessions.filter(
        (s) => s.sessionStatusId?.sessionStatusName === "Canceled",
      ).length,
      upcomingSessions: sessions.filter((s) =>
        ["Scheduled", "Attended"].includes(
          s.sessionStatusId?.sessionStatusName,
        ),
      ).length,
    };

    res.status(200).json(summary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllSessions = async (req, res) => {
  try {
    const { Today, physioId, storedRole } = req.body;

    const sessionCompletedId = new mongoose.Types.ObjectId(
      "691ec69eae0e10763c8f21e0",
    );
    const sessionCancelledId = new mongoose.Types.ObjectId(
      "692585f037162b40bd30a1ef",
    );

    let filter = {};

    /* ---------------- PHYSIO BLOCK CHECK ---------------- */
    if (storedRole === "Physio" && physioId && Today) {
      const today = new Date(Today);
      if (!isNaN(today)) {
        let lastWorkingDay = new Date(today);

        if (today.getDay() === 1) {
          lastWorkingDay.setDate(today.getDate() - 2);
        } else {
          lastWorkingDay.setDate(today.getDate() - 1);
        }

        const startOfLastDay = new Date(lastWorkingDay);
        startOfLastDay.setHours(0, 0, 0, 0);

        const endOfLastDay = new Date(lastWorkingDay);
        endOfLastDay.setHours(23, 59, 59, 999);

        const incompleteSessions = await Session.find({
          physioId,
          sessionDate: { $gte: startOfLastDay, $lte: endOfLastDay },
          sessionStatusId: { $nin: [sessionCompletedId, sessionCancelledId] },
        })
          .populate("physioId", "physioName")
          .populate({
            path: "patientId",
            populate: { path: "patientGenderId", select: "genderName" },
          })
          .populate("sessionStatusId", "sessionStatusName sessionStatusColor");

        if (incompleteSessions.length > 0) {
          return res.status(200).json({
            message:
              "Previous Incomplete sessions exists, Please complete them to start today's session",
            incompleteData: incompleteSessions,
            blockToday: true,
          });
        }
      }
    }

    /* ---------------- DATE FILTER (SAFE) ---------------- */
    if (Today) {
      const date = new Date(Today);
      if (!isNaN(date)) {
        const startDay = new Date(date);
        startDay.setHours(0, 0, 0, 0);

        const endDay = new Date(date);
        endDay.setHours(23, 59, 59, 999);

        filter.sessionDate = { $gte: startDay, $lte: endDay };
      }
    }

    /* ---------------- PHYSIO FILTER ---------------- */
    if (storedRole === "Physio" && physioId) {
      filter.physioId = physioId;
    }

    const sessions = await Session.find(filter)
      .populate("physioId", "physioName")
      .populate({
        path: "patientId",
        populate: { path: "patientGenderId", select: "genderName" },
      })
      .populate("modalitiesList.modalityId", "modalitiesName")
      .populate("machineId", "machineName")
      .populate(
        "sessionStatusId",
        "sessionStatusName sessionStatusColor sessionStatusTextColor",
      )
      .populate("redFlags.redFlagId", "redflagName")
      .sort({ sessionTime: 1 });

    const filteredSessions = sessions.filter((s) => {
      if (!s.patientId) return false;

      const sDate = new Date(s.sessionDate);
      sDate.setHours(0, 0, 0, 0);

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      if (s.patientId.isRecovered === true && sDate > now) {
        return false;
      }
      return true;
    });

    res.status(200).json(filteredSessions);
  } catch (error) {
    console.error("Get all sessions error:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.deleteDuplicateSession = async (req, res) => {
  try {
    const { patientId, physioId, sessionTime } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(patientId) ||
      !mongoose.Types.ObjectId.isValid(physioId)
    ) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const result = await Session.deleteMany({
      patientId: patientId,
      physioId: physioId,
      sessionTime: sessionTime,
    });

    res.status(200).json({
      message: "sessions deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllSessionsbyPatient = async (req, res) => {
  try {
    const { sessionDate, nextDate, physioId, storedRole, patientId } = req.body;

    //ALWAYS define filter first
    let filter = {};

    // Date filter
    if (sessionDate && nextDate) {
      filter.sessionDate = {
        $gte: new Date(sessionDate),
        $lt: new Date(nextDate),
      };
    }

    if (patientId) {
      const mongoose = require("mongoose");
      filter.patientId = new mongoose.Types.ObjectId(patientId);
    }

    //  Role based filter
    if (storedRole === "Physio" && physioId) {
      filter.physioId = physioId;
    }

    const sessions = await Session.find(filter)
      .populate("physioId", "physioName")
      .populate({
        path: "patientId",
        populate: { path: "patientGenderId", select: "genderName" },
      })
      .populate("sessionFeedbackPros", "sessionFeedbackCons")
      .populate("modalitiesList.modalityId", "modalitiesName")
      .populate("machineId", "machineName")
      .populate(
        "sessionStatusId",
        "sessionStatusName sessionStatusColor sessionStatusTextColor",
      )
      .populate("redFlags.redFlagId", "redflagName");

    // Always return array
    return res.status(200).json(sessions || []);
  } catch (error) {
    console.error("Get all sessions error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get a single Session by id
exports.getSingleSession = async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.body });

    if (!session) {
      return res.status(400).json({ message: "Session not found" });
    }

    res.status(200).json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a Session
exports.updateSession = async (req, res) => {
  try {
    const {
      _id,
      sessionCode,
      patientId,
      physioId,
      sessionDate,
      sessionDay,
      sessionTime,
      sessionFromTime,
      sessionToTime,
      sessionCount,
      sessionStatusId,
      sessionFeedbackPros,
      sessionFeedbackCons,
      modeOfExercise,
      redFlags,
      homeExerciseAssigned,
      modalitiesList,
      targetArea,
      media,
      modalities,
    } = req.body;
    let sessionDateTime;
    if (sessionDate && sessionTime) {
      sessionDateTime = new Date(
        `${new Date(sessionDate).toISOString().split("T")[0]}T${sessionTime}:00`,
      );
    }

    const session = await Session.findByIdAndUpdate(
      _id,
      {
        $set: {
          sessionCode,
          patientId,
          physioId,
          sessionDate,
          sessionDateTime, // ADD
          sessionDay,
          sessionTime,
          sessionFromTime,
          sessionToTime,
          sessionStatusId,
          sessionFeedbackPros,
          sessionFeedbackCons,
          modeOfExercise,
          redFlags,
          sessionCount,
          homeExerciseAssigned,
          modalitiesList,
          targetArea,
          media,
          modalities,
        },
      },
      { new: true, runValidators: true },
    );

    if (!session) {
      return res.status(400).json({ message: "session Cant able to update" });
    }

    res
      .status(200)
      .json({ message: "session updated successfully", data: session });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a session
exports.deleteSession = async (req, res) => {
  try {
    let { _id } = req.body;
    // If _id comes as object, extract real id
    if (typeof _id === "object" && _id._id) {
      _id = _id._id;
    }

    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const session = await Session.findByIdAndDelete(_id);

    if (!session) {
      return res.status(400).json({ message: "Session not able to deleted" });
    }

    res.status(200).json({ message: "Session deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//Session Start Controller

exports.SessionStart = async (req, res) => {
  try {
    const { _id, sessionFromTime, action } = req.body;

    const Status = await SessionStatus.findOne({ sessionStatusName: action });
    if (!Status) {
      res.status(400).json({ message: "Session Status is not found" });
    }
    const session = await Session.findByIdAndUpdate(
      _id,
      {
        $set: { sessionFromTime: sessionFromTime, sessionStatusId: Status._id },
      },
      { new: true, runValidators: true },
    );
    if (!session) {
      res.status(400).json({ message: "Session not started" });
    }
    res.status(200).json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.sessionStop = async (req, res) => {
  try {
    const { _id, action } = req.body;

    const Status = await SessionStatus.findOne({ sessionStatusName: action });
    if (!Status) {
      res.status(400).json({ message: "Session Status is not found" });
    }
    const session = await Session.findByIdAndUpdate(
      _id,
      {
        $set: { sessionStatusId: Status._id },
      },
      { new: true, runValidators: true },
    );
    if (!session) {
      res.status(400).json({ message: "Session not started" });
    }
    res.status(200).json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.SessionCancel = async (req, res) => {
  try {
    const {
      _id,
      action,
      physioId,
      cancelledKms,
      userRole,
      physioName,
      petrolAllowanceClaimed,
      cancelledReason,
    } = req.body;
    console.log(cancelledReason, "cancelledReason");
    const Status = await SessionStatus.findOne({ sessionStatusName: action });
    if (!Status) {
      return res.status(400).json({ message: "Session Status is not found" });
    }

    const cancelledSession = await Session.findByIdAndUpdate(
      _id,
      {
        $set: {
          sessionStatusId: Status._id,
          sessionCancelReason: cancelledReason,
          sessionFeedbackCons: cancelledReason,
          petrolAllowanceClaimed: petrolAllowanceClaimed,
        },
      },
      { new: true, runValidators: true },
    );
    console.log(cancelledSession, "cancelledSession");
    if (!cancelledSession) {
      return res.status(400).json({ message: "Session not found" });
    }

    try {
      const patient = await Patient.findById(cancelledSession.patientId);

      const roles = await RoleBased.find({
        RoleName: { $in: ["Admin", "SuperAdmin", "HOD"] },
      });
      const roleIds = roles.map((r) => r._id);

      const staffToNotify = await Employee.find({
        roleId: { $in: roleIds },
      });

      const recipientIds = new Set(
        staffToNotify.map((emp) => emp._id.toString()),
      );
      if (cancelledSession.physioId) {
        recipientIds.add(cancelledSession.physioId.toString());
      }

      const io = req.app.get("socketio");

      const notificationPromises = Array.from(recipientIds).map(
        async (empId) => {
          const notification = new Notification({
            fromEmployeeId: cancelledSession.physioId,
            toEmployeeId: empId,
            message: `Session ${cancelledSession.sessionCode} for ${
              patient?.patientName || "Patient"
            } has been cancelled and the Reason is ${
              cancelledSession.sessionCancelReason
            } for the date of ${cancelledSession.sessionDate.toLocaleDateString()} - ${userRole} (${physioName}) - ${petrolAllowanceClaimed ? "Petrol Allowance Claimed" : "Petrol Allowance Not Claimed"}.`,
            type: "general",
            status: "unseen",
            meta: {
              SessionId: cancelledSession._id,
              PatientId: cancelledSession.patientId,
            },
          });

          await notification.save();

          if (io) {
            io.to(empId).emit("receiveNotification", notification);
          }
        },
      );

      await Promise.all(notificationPromises);
    } catch (notifyErr) {
      console.error("Cancellation Notification Error:", notifyErr.message);
    }

    res.status(200).json({
      message: "Session cancelled, rescheduled, and notifications sent.",
      cancelledSession,
    });

    const patientData = await Patient.findById(cancelledSession.patientId);
    if (patientData) {
      // let kmsToAdd = patientData.KmsfLPatienttoHub || 0;
      const allowanceDate = new Date(cancelledSession.sessionDate);
      allowanceDate.setHours(12, 0, 0, 0);
      let travelKm = 0;
      if (petrolAllowanceClaimed) {
        const dayStart = new Date(cancelledSession.sessionDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(cancelledSession.sessionDate);
        dayEnd.setHours(23, 59, 59, 999);
        const completedSessionStatus = await SessionStatus.find({
          sessionStatusName: { $in: ["Completed", "Attended"] },
        }).select("_id");
        const StatusIds = completedSessionStatus.map((s) => s._id);
        const firstCompleteSession = await Session.findOne({
          physioId: cancelledSession.physioId,
          sessionDate: { $gte: dayStart, $lte: dayEnd },
          sessionStatusId: { $in: StatusIds },
        })
          .sort({ sessionToTime: 1 })
          .populate("patientId");
        if (firstCompleteSession?.patientId) {
          travelKm = Number(firstCompleteSession.patientId.KmsfromHub || 0);
        } else {
          const patientData = await Patient.findById(
            cancelledSession.patientId,
          );
          if (patientData) {
            travelKm =
              patientData.visitOrder == 1
                ? Number(patientData.KmsfromHub || 0)
                : Number(patientData.kmsFromPrevious || 0);
          }
        }

        // if (patientData.visitOrder === 1) {
        //   kmsToAdd = patientData.KmsfromHub || 0;
        // } else {
        //   kmsToAdd = patientData.kmsFromPrevious || 0;
        // }
      }

      await PetrolAllowance.findOneAndUpdate(
        {
          physioId: cancelledSession.physioId,
          date: allowanceDate,
        },
        {
          $set: { petrolAllowanceClaimed: petrolAllowanceClaimed },

          $inc: {
            completedKms: travelKm,
            // canceledKms: cancelledKms || 0,
            finalDailyKms: travelKm,
          },
        },
        { new: true, upsert: true },
      );
    }
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    }
  }
};

exports.SessionEnd = async (req, res) => {
  const mongooseSession = await mongoose.startSession();
  mongooseSession.startTransaction();

  try {
    const {
      _id,
      machineId,
      sessionFeedbackPros,
      redFlags,
      targetArea,
      modeOfExercise,
      modalities,
      modalitiesList,
      sessionToTime,
      action,
    } = req.body;

    let sessionend = {
      _id,
      sessionFeedbackPros,
      redFlags,
      targetArea,
      modeOfExercise,
      modalities,
      modalitiesList,
      sessionToTime,
    };
    if (machineId) sessionend.machineId = machineId;

    const Status = await SessionStatus.findOne({
      sessionStatusName: action,
    }).session(mongooseSession);
    if (!Status) {
      throw new Error("Session Status is not found");
    }
    sessionend.sessionStatusId = Status._id;

    const session = await Session.findByIdAndUpdate(
      _id,
      { $set: sessionend },
      { new: true, runValidators: true, session: mongooseSession },
    );

    if (!session) throw new Error("Session is not found");

    const patient = await Patient.findById(session.patientId)
      .populate("FeesTypeId")
      .session(mongooseSession);

    if (
      patient &&
      patient.FeesTypeId?.feesTypeName === "PerMonth" &&
      session.sessionCount === 26
    ) {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfToday = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        23,
        59,
        59,
      );

      await Bill.create(
        [
          {
            patientId: patient._id,
            physioId: session.physioId,
            paymentType: "Partial Payment",
            paymentStatus: "Pending",
            ReceivedAmount: 0,
            TotalBilledAmount: patient.feeAmount || 0,
            NetBilledAmount: patient.feeAmount || 0,
            startDate: startOfMonth,
            ToDate: endOfToday,
            month: today.toLocaleString("default", { month: "long" }),
            year: today.getFullYear(),
            TotalSessionCount: session.sessionCount,
          },
        ],
        { session: mongooseSession },
      );

      await Session.updateMany(
        {
          patientId: patient._id,
          sessionDate: { $gte: startOfMonth, $lte: endOfToday },
          isBilled: false,
        },
        { $set: { isBilled: true } },
        { session: mongooseSession },
      );

      await triggerRoleNotifications(
        req,
        session,
        patient,
        "Monthly-Bill-Alert",
      );
    }

    if (redFlags && redFlags.length > 0) {
      const formattedRedFlags = redFlags.map((r) => ({
        redFlagId: new mongoose.Types.ObjectId(r.redFlagId?._id || r.redFlagId),
      }));

      const reviewTypeDefault = await ReviewType.findOne({
        reviewTypeName: "RedFlags",
      }).session(mongooseSession);
      const reviewStatusDefault = await ReviewStatus.findOne({
        reviewStatusName: "Pending",
      }).session(mongooseSession);

      if (reviewTypeDefault && reviewStatusDefault) {
        const newReview = await Review.create(
          [
            {
              patientId: session.patientId,
              physioId: session.physioId,
              reviewDate: session.sessionDate,
              sessionId: session._id,
              reviewTypeId: reviewTypeDefault._id,
              redFlags: formattedRedFlags,
              reviewStatusId: reviewStatusDefault._id,
            },
          ],
          { session: mongooseSession },
        );

        await triggerRoleNotifications(req, session, patient, newReview[0]);
      }
    }

    // --- PETROL ALLOWANCE (Inside Transaction) ---
    if (patient) {
      let kmsToAdd =
        patient.visitOrder === 1
          ? patient.KmsfromHub || 0
          : patient.kmsFromPrevious || 0;
      const allowanceDate = new Date(session.sessionDate);
      allowanceDate.setHours(12, 0, 0, 0);

      await PetrolAllowance.findOneAndUpdate(
        { physioId: session.physioId, date: allowanceDate },
        { $inc: { completedKms: kmsToAdd, finalDailyKms: kmsToAdd } },
        { new: true, upsert: true, session: mongooseSession },
      );
    }

    // 3. Commit the Transaction
    await mongooseSession.commitTransaction();
    res.status(200).json(session);
  } catch (error) {
    // 4. Rollback on Error
    await mongooseSession.abortTransaction();
    console.error("❌ Transaction Aborted. Error Ending Session:", error);
    res.status(500).json({ message: error.message });
  } finally {
    // 5. End Session
    mongooseSession.endSession();
  }
};

async function triggerRoleNotifications(req, session, patient, type) {
  const roles = await RoleBased.find({
    RoleName: { $in: ["Admin", "SuperAdmin", "HOD"] },
  });
  const staff = await Employee.find({
    roleId: { $in: roles.map((r) => r._id) },
  });
  const io = req.app.get("socketio");

  for (const person of staff) {
    const note = await Notification.create({
      fromEmployeeId: session.physioId,
      toEmployeeId: person._id,
      message: `Patient ${patient.patientName} reached 26 sessions. Bill generated.`,
      type,
      meta: { PatientId: patient._id },
    });
    if (io) io.to(person._id.toString()).emit("receiveNotification", note);
  }
}

exports.sessionCancelRevert = async (req, res) => {
  try {
    const { sessionId } = req.body;

    const scheduledStatus = await SessionStatus.findOne({
      sessionStatusName: "Scheduled",
    });

    if (!scheduledStatus) {
      return res.status(400).json({ error: "Scheduled status not found" });
    }

    await Session.findByIdAndUpdate(sessionId, {
      sessionStatusId: scheduledStatus._id,
      cancelledReason: "",
      sessionFeedbackCons: "",
      cancelledKms: 0,
    });

    res.json({
      success: true,
      message: "Session reverted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Revert failed" });
  }
};
