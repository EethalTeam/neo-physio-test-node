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
      sessionDate,
      sessionDay,
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

    const lastSession = await Session.findOne(
      {},
      {},
      { sort: { createdAt: -1 } },
    );
    let nextSessionNumber = 1;

    if (lastSession && lastSession.sessionCode) {
      const lastNumber = parseInt(
        lastSession.sessionCode.replace("SESSION", ""),
      );
      nextSessionNumber = isNaN(lastNumber) ? 1 : lastNumber + 1;
    }

    const sessionCode = `SESSION${String(nextSessionNumber).padStart(3, "0")}`;
    const sessionDateTime = new Date(
      `${sessionDate.toISOString().split("T")[0]}T${sessionTime}:00`,
    );
    // Create and save the Session
    const session = new Session({
      sessionCode,
      patientId,
      physioId,
      sessionDate,
      sessionDay,
      sessionTime,
      sessionFromTime,
      sessionDateTime,
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
    });
    await session.save();

    res.status(200).json({
      message: "Session created successfully",
      data: session,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
exports.getAllSessions = async (req, res) => {
  try {
    const { Today, physioId, storedRole } = req.body;

    const sessionCompletedId = new mongoose.Types.ObjectId(
      "691ec69eae0e10763c8f21e0",
    );
    const sessionCancelledId = new mongoose.Types.ObjectId(
      "692585f037162b40bd30a1ef",
    );

    if (storedRole === "Physio" && physioId) {
      const today = new Date(Today);
      let lastWorkingDay = new Date(today);

      if (today.getDay() === 1) {
        lastWorkingDay.setDate(today.getDate() - 2);
      } else {
        lastWorkingDay.setDate(today.getDate() - 1);
      }

      const startOfLastDay = new Date(lastWorkingDay).setHours(0, 0, 0, 0);
      const endOfLastDay = new Date(lastWorkingDay).setHours(23, 59, 59, 999);

      const incompleteSessions = await Session.find({
        physioId: new mongoose.Types.ObjectId(physioId),
        sessionDate: {
          $gte: new Date(startOfLastDay),
          $lte: new Date(endOfLastDay),
        },
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

    let filter = {};
    const startOfRequestedDay = new Date(Today).setHours(0, 0, 0, 0);
    const endOfRequestedDay = new Date(Today).setHours(23, 59, 59, 999);

    filter.sessionDate = {
      $gte: new Date(startOfRequestedDay),
      $lte: new Date(endOfRequestedDay),
    };

    if (storedRole === "Physio" && physioId) {
      filter.physioId = new mongoose.Types.ObjectId(physioId);
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
      .sort({ sessionDateTime: 1 });

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

    return res.status(200).json(filteredSessions || []);
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
    const { _id } = req.body;

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
    const { _id, action, cancelledKms, cancelledReason } = req.body;
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
        },
      },
      { new: true, runValidators: true },
    );
    console.log(cancelledSession, "cancelledSession");
    if (!cancelledSession) {
      return res.status(400).json({ message: "Session not found" });
    }

    // --- RESCHEDULING LOGIC (AS PREVIOUSLY IMPLEMENTED) ---
    const lastSession = await Session.findOne({
      patientId: cancelledSession.patientId,
    }).sort({ sessionDate: -1 });

    if (lastSession) {
      let nextDate = new Date(lastSession.sessionDate);
      let foundNextDate = false;
      while (!foundNextDate) {
        nextDate.setDate(nextDate.getDate() + 1);
        if (nextDate.getDay() !== 0) foundNextDate = true;
      }

      const counter = await Counter.findByIdAndUpdate(
        { _id: "sessionCode" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
      );

      const formattedCode = `SESS-${String(counter.seq).padStart(6, "0")}`;
      const daysOfWeek = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];

      const newSessionDateTime = new Date(
        `${nextDate.toISOString().split("T")[0]}T${cancelledSession.sessionTime}:00`,
      );

      await Session.create({
        patientId: cancelledSession.patientId,
        physioId: cancelledSession.physioId,
        sessionDate: nextDate,
        sessionDateTime: newSessionDateTime, // ADD
        sessionTime: cancelledSession.sessionTime,
        sessionStatusId: new mongoose.Types.ObjectId(
          "691ecb36b87c5c57dead47a7",
        ),
        sessionDay: daysOfWeek[nextDate.getDay()],
        sessionCode: formattedCode,
      });
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
            } for the date of ${cancelledSession.sessionDate.toLocaleDateString()}. A replacement session has been scheduled.`,
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
      let kmsToAdd = patientData.KmsfLPatienttoHub || 0;
      const allowanceDate = new Date(cancelledSession.sessionDate);
      allowanceDate.setHours(12, 0, 0, 0);

      await PetrolAllowance.findOneAndUpdate(
        { physioId: cancelledSession.physioId, date: allowanceDate },
        {
          $inc: {
            completedKms: kmsToAdd,
            canceledKms: cancelledKms || 0,
            finalDailyKms: kmsToAdd,
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
    if (machineId) {
      sessionend.machineId = machineId;
    }

    const Status = await SessionStatus.findOne({ sessionStatusName: action });
    if (!Status) {
      return res.status(400).json({ message: "Session Status is not found" });
    } else {
      sessionend.sessionStatusId = Status._id;
    }
    const sessionCounter = Session.find({ sessionStatusId: Status._id });

    if (sessionCounter.length > 0) {
      sessionend.sessionCount = sessionCounter.length + 1;
    } else {
      sessionend.sessionCount = 1;
    }
    const session = await Session.findByIdAndUpdate(
      _id,
      { $set: sessionend },
      { new: true, runValidators: true },
    );

    if (!session) {
      return res.status(400).json({ message: "Session End is not found" });
    }
    const patient = await Patient.findById(session.patientId);

    // GENERATE REVIEW AND NOTIFY HOD IF REDFLAGS EXIST
    if (redFlags && redFlags.length > 0) {
      // const formattedRedFlags = redFlags.map((id) => ({
      //   redFlagId: new mongoose.Types.ObjectId(id.redFlagId),
      // }));

      const formattedRedFlags = (redFlags || []).map((r) => {
        let id = r.redFlagId;

        if (typeof id === "object" && id._id) {
          id = id._id;
        }

        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
          throw new Error("Invalid redFlagId provided");
        }

        return { redFlagId: new mongoose.Types.ObjectId(id) };
      });

      const reviewTypeDefault = await ReviewType.findOne({
        reviewTypeName: "RedFlags",
      });
      const reviewStatusDefault = await ReviewStatus.findOne({
        reviewStatusName: "Pending",
      });

      if (reviewTypeDefault && reviewStatusDefault) {
        const newReview = await Review.create({
          patientId: session.patientId,
          physioId: session.physioId,
          reviewDate: session.sessionDate,
          sessionId: session._id,
          reviewTypeId: new mongoose.Types.ObjectId(reviewTypeDefault._id),
          redFlags: formattedRedFlags,
          reviewStatusId: new mongoose.Types.ObjectId(reviewStatusDefault._id),
        });

        // --- START NOTIFICATION LOGIC ---
        try {
          const roleId = await RoleBased.findOne({ RoleName: "HOD" });
          if (!roleId) {
            res.status(400).json({ message: "HOD role not found" });
          }
          const hodEmployees = await Employee.find({ roleId: roleId._id }); // Ensure "role" field matches your Employee schema
          const io = req.app.get("socketio");

          if (hodEmployees.length > 0) {
            const notificationPromises = hodEmployees.map(async (hod) => {
              const notification = new Notification({
                fromEmployeeId: session.physioId,
                toEmployeeId: hod._id,
                message: `Red Flag Alert! A session for patient ${
                  patient?.patientName || "N/A"
                } has been ended with red flags.`,
                type: "Red-Flag-Alert",
                status: "unseen",
                meta: {
                  SessionId: session._id,
                  PhysioId: session.physioId,
                  PatientId: session.patientId,
                  ReviewId: newReview._id,
                },
              });

              await notification.save();

              if (io) {
                io.to(hod._id.toString()).emit(
                  "receiveNotification",
                  notification,
                );
              }
            });

            await Promise.all(notificationPromises);
          }
        } catch (notifyErr) {
          console.error("HOD Notification failed:", notifyErr.message);
        }
        // --- END NOTIFICATION LOGIC ---
      }
    }

    // 3. PETROL ALLOWANCE LOGIC (Existing)
    if (patient) {
      // ... (Your existing petrol logic remains untouched) ...
      let kmsToAdd = 0;
      if (patient.visitOrder === 1) {
        kmsToAdd = patient.KmsfromHub || 0;
      } else {
        kmsToAdd = patient.kmsFromPrevious || 0;
      }

      if (patient.KmsfLPatienttoHub && patient.KmsfLPatienttoHub > 0) {
        kmsToAdd += patient.KmsfLPatienttoHub;
      }

      const allowanceDate = new Date(session.sessionDate);
      allowanceDate.setHours(12, 0, 0, 0);

      await PetrolAllowance.findOneAndUpdate(
        { physioId: session.physioId, date: allowanceDate },
        {
          $inc: {
            completedKms: kmsToAdd,
            finalDailyKms: kmsToAdd,
          },
        },
        { new: true, upsert: true },
      );
    }

    res.status(200).json(session);
  } catch (error) {
    console.error("Error Ending Session:", error);
    res.status(500).json({ message: error.message });
  }
};
