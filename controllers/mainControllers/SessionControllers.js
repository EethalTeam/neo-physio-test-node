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
const Bill = require("../../model/masterModels/Bill");
const Debit = require("../../model/masterModels/DebitPayment");
const Payroll = require("../../model/masterModels/Payroll");
const Physio = require("../../model/masterModels/Physio");

// Create a new Session
exports.createSession = async (req, res) => {
  const mongooseSession = await mongoose.startSession();
  mongooseSession.startTransaction();

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

    const createdSessions = [];
    const skippedDates = [];

    //  get patient active cycle
    const patient = await Patient.findById(patientId).session(mongooseSession);

    if (!patient) {
      await mongooseSession.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    const cycleId = patient.activeCycleId || null;

    for (const dateStr of sessionDates) {
      const currentDate = new Date(dateStr);

      if (currentDate.getDay() === 0) {
        skippedDates.push({ date: dateStr, reason: "Sunday is not allowed" });
        continue;
      }

      const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
      const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

      const existingSession = await Session.findOne({
        patientId,
        sessionDate: { $gte: startOfDay, $lte: endOfDay },
      }).session(mongooseSession);

      if (existingSession) {
        skippedDates.push({
          date: dateStr,
          reason: "Session already exists for this date",
        });
        continue;
      }

      const totalSessionCount = await Session.countDocuments({
        patientId,
      }).session(mongooseSession);

      const monthStart = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1,
      );

      const monthEnd = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        1,
      );

      const completedStatus = await SessionStatus.findOne({
        sessionStatusName: "Completed",
      }).session(mongooseSession);

      const monthlySessionCount = await Session.countDocuments({
        patientId,
        cycleId, // ✅ IMPORTANT (you already have it)
        sessionDate: { $gte: monthStart, $lt: monthEnd },
      });
      console.log(monthlySessionCount, "monthlySessionCount");
      const counter = await Counter.findOneAndUpdate(
        { _id: "sessionCode" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, session: mongooseSession },
      );

      const formattedCode = `SESS-${String(counter.seq).padStart(6, "0")}`;

      const newSession = new Session({
        sessionCode: formattedCode,
        patientId,
        physioId,

        // use patient active cycle only
        cycleId,

        sessionDate: startOfDay,
        sessionDay: startOfDay.toLocaleDateString("en-IN", {
          weekday: "long",
        }),

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

        sessionCount: totalSessionCount + 1,
        monthlySessionCount: monthlySessionCount + 1,
      });

      const savedSession = await newSession.save({ session: mongooseSession });
      createdSessions.push(savedSession);
    }

    await mongooseSession.commitTransaction();

    return res.status(200).json({
      success: true,
      message: `${createdSessions.length} sessions created successfully.`,
      data: createdSessions,
      skipped: skippedDates,
    });
  } catch (error) {
    await mongooseSession.abortTransaction();
    console.error(
      "❌ Session creation failed. Transaction rolled back:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    mongooseSession.endSession();
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
      return res.status(400).json({
        success: false,
        message: "physioId, month and year are required",
      });
    }

    const selectedMonth = Number(month);
    const selectedYear = Number(year);

    if (
      Number.isNaN(selectedMonth) ||
      Number.isNaN(selectedYear) ||
      selectedMonth < 1 ||
      selectedMonth > 12
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid month or year",
      });
    }

    const physioObjectId = new mongoose.Types.ObjectId(physioId);

    const physioData = await Physio.findById(physioObjectId).populate(
      "roleId",
      "RoleName",
    );

    if (!physioData) {
      return res.status(404).json({
        success: false,
        message: "Physio not found",
      });
    }

    const roleName = physioData?.roleId?.RoleName || "";
    const isHOD = roleName === "HOD";

    const startDate = new Date(selectedYear, selectedMonth - 1, 1);
    const endDate = new Date(selectedYear, selectedMonth, 1);

    let totalSessions = 0;
    let completedSessions = 0;
    let cancelledSessions = 0;
    let upcomingSessions = 0;

    let totalReviews = 0;
    let completedReviews = 0;
    let pendingReviews = 0;

    if (isHOD) {
      const reviews = await Review.find({
        reviewDate: { $gte: startDate, $lt: endDate },
      }).populate("reviewStatusId", "reviewStatusName");

      totalReviews = reviews.length;

      completedReviews = reviews.filter(
        (r) => r.reviewStatusId?.reviewStatusName === "Completed",
      ).length;

      pendingReviews = reviews.filter((r) =>
        ["Pending", "Scheduled"].includes(r.reviewStatusId?.reviewStatusName),
      ).length;

      // keep same response keys for frontend compatibility
      totalSessions = totalReviews;
      completedSessions = completedReviews;
      upcomingSessions = pendingReviews;
      cancelledSessions = 0;
    } else {
      const sessions = await Session.find({
        physioId: physioObjectId,
        sessionDate: { $gte: startDate, $lt: endDate },
      }).populate("sessionStatusId", "sessionStatusName");

      totalSessions = sessions.length;

      completedSessions = sessions.filter(
        (s) => s.sessionStatusId?.sessionStatusName === "Completed",
      ).length;

      cancelledSessions = sessions.filter(
        (s) => s.sessionStatusId?.sessionStatusName === "Canceled",
      ).length;

      upcomingSessions = sessions.filter((s) =>
        ["Scheduled", "Attended"].includes(
          s.sessionStatusId?.sessionStatusName,
        ),
      ).length;
    }

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const selectedMonthName = monthNames[selectedMonth - 1];

    // previous month payroll
    let payrollMonth = selectedMonth - 1;
    let payrollYear = selectedYear;

    if (payrollMonth === 0) {
      payrollMonth = 12;
      payrollYear = selectedYear - 1;
    }

    const payrollMonthName = monthNames[payrollMonth - 1];

    const today = new Date();
    const salaryVisibleDate = new Date(selectedYear, selectedMonth - 1, 10);

    let payrollDoc = null;
    let monthlySalary = 0;
    let salaryVisible = false;

    const isPastMonth =
      selectedYear < today.getFullYear() ||
      (selectedYear === today.getFullYear() &&
        selectedMonth < today.getMonth() + 1);

    const isCurrentMonth =
      selectedYear === today.getFullYear() &&
      selectedMonth === today.getMonth() + 1;

    const isFutureMonth =
      selectedYear > today.getFullYear() ||
      (selectedYear === today.getFullYear() &&
        selectedMonth > today.getMonth() + 1);

    // salary rules
    // past month -> visible
    // current month -> visible only after 10th
    // future month -> not visible
    if (isPastMonth || (isCurrentMonth && today >= salaryVisibleDate)) {
      salaryVisible = true;

      payrollDoc = await Payroll.findOne({
        physioId: physioObjectId,
        payrRollYear: payrollYear,
        $or: [
          { payrRollMonth: String(payrollMonth) },
          { payrRollMonth: payrollMonthName },
          {
            payrRollMonth: {
              $regex: new RegExp(`^${payrollMonthName}$`, "i"),
            },
          },
        ],
      }).lean();

      monthlySalary = Number(payrollDoc?.NetSalary || 0);
    }

    return res.status(200).json({
      success: true,

      // common keys for frontend
      totalSessions,
      completedSessions,
      cancelledSessions,
      upcomingSessions,

      // extra keys for HOD clarity
      totalReviews: isHOD ? totalReviews : 0,
      completedReviews: isHOD ? completedReviews : 0,
      pendingReviews: isHOD ? pendingReviews : 0,

      monthlySalary,
      payroll: payrollDoc || null,
      salaryVisible,
      salaryVisibleAfter: salaryVisibleDate,

      payrollMonth,
      payrollMonthName,
      payrollYear,

      selectedMonth,
      selectedMonthName,
      selectedYear,

      isHOD,
      roleName,
    });
  } catch (error) {
    console.error("getMonthlySummary error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
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
        const startOfToday = new Date(today);
        startOfToday.setHours(0, 0, 0, 0);
        const endOfLastDay = new Date(lastWorkingDay);
        endOfLastDay.setHours(23, 59, 59, 999);

        const incompleteSessions = await Session.find({
          physioId,
          sessionDate: { $lt: startOfToday },
          // sessionDate: { $gte: startOfLastDay, $lte: endOfLastDay },
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

    // filter.sessionStatusId = sessionCompletedId;

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

    const filter = {};

    if (sessionDate && nextDate) {
      filter.sessionDate = {
        $gte: new Date(sessionDate),
        $lt: new Date(nextDate),
      };
    }

    if (patientId && mongoose.Types.ObjectId.isValid(patientId)) {
      filter.patientId = new mongoose.Types.ObjectId(patientId);
    }

    if (storedRole === "Physio" && physioId) {
      filter.physioId = physioId;
    }

    const sessions = await Session.find(filter)
      .sort({ sessionDate: 1, createdAt: 1 })
      .populate("physioId", "physioName")
      .populate({
        path: "patientId",
        populate: { path: "patientGenderId", select: "genderName" },
      })
      .populate(
        "sessionStatusId",
        "sessionStatusName sessionStatusColor sessionStatusTextColor",
      )
      .populate("modalitiesList.modalityId", "modalitiesName")
      .populate("machineId", "machineName")
      .populate("redFlags.redFlagId", "redflagName");

    return res.status(200).json(Array.isArray(sessions) ? sessions : []);
  } catch (error) {
    console.error("Get all sessions error:", error);
    return res.status(500).json({ message: error.message });
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
      cancelledKms,
      userRole,
      physioName,
      petrolAllowanceClaimed,
      cancelledReason,
    } = req.body;

    const isPetrolClaimed =
      petrolAllowanceClaimed === true || petrolAllowanceClaimed === "true";

    const statusData = await SessionStatus.findOne({
      sessionStatusName: action,
    });

    if (!statusData) {
      return res.status(400).json({ message: "Session Status is not found" });
    }

    const cancelledSession = await Session.findByIdAndUpdate(
      _id,
      {
        $set: {
          sessionStatusId: statusData._id,
          sessionCancelReason: cancelledReason,
          sessionFeedbackCons: cancelledReason,
          petrolAllowanceClaimed: isPetrolClaimed,
          cancelledKms: cancelledKms || 0,
        },
      },
      { new: true, runValidators: true },
    );

    if (!cancelledSession) {
      return res.status(400).json({ message: "Session not found" });
    }

    try {
      const patient = await Patient.findById(cancelledSession.patientId);
      const io = req.app.get("socketio");

      const hodRole = await RoleBased.findOne({ RoleName: "HOD" });
      const adminRole = await RoleBased.findOne({ RoleName: "Admin" });
      const superAdminRole = await RoleBased.findOne({
        RoleName: "SuperAdmin",
      });

      const hodEmployees = hodRole
        ? await Employee.find({ roleId: hodRole._id }).select("_id")
        : [];

      const adminEmployees = adminRole
        ? await Employee.find({ roleId: adminRole._id }).select("_id")
        : [];

      const superAdminEmployees = superAdminRole
        ? await Employee.find({ roleId: superAdminRole._id }).select("_id")
        : [];

      const notificationsToCreate = [];

      const commonMessage = `Session ${cancelledSession.sessionCode} for ${
        patient?.patientName || "Patient"
      } has been cancelled for ${new Date(
        cancelledSession.sessionDate,
      ).toLocaleDateString("en-IN")}. Reason: ${
        cancelledSession.sessionCancelReason || "No reason provided"
      }. Cancelled by ${userRole} (${physioName}).`;

      const commonMeta = {
        SessionId: cancelledSession._id,
        PatientId: cancelledSession.patientId,
        PhysioId: cancelledSession.physioId,
        Date: cancelledSession.sessionDate,
      };

      // ✅ HOD notifications
      for (const hod of hodEmployees) {
        notificationsToCreate.push({
          fromEmployeeId: cancelledSession.physioId,
          toEmployeeId: hod._id,
          message: commonMessage,
          type: "Session-Cancellation",
          status: "unseen",
          meta: commonMeta,
        });
      }

      // ✅ Admin notifications
      for (const admin of adminEmployees) {
        notificationsToCreate.push({
          fromEmployeeId: cancelledSession.physioId,
          toEmployeeId: admin._id,
          message: commonMessage,
          type: "Session-Cancellation",
          status: "unseen",
          meta: commonMeta,
        });
      }

      // ✅ Super Admin notifications
      for (const superAdmin of superAdminEmployees) {
        notificationsToCreate.push({
          fromEmployeeId: cancelledSession.physioId,
          toEmployeeId: superAdmin._id,
          message: commonMessage,
          type: "Session-Cancellation",
          status: "unseen",
          meta: commonMeta,
        });
      }

      // ✅ Physio self notification
      if (cancelledSession.physioId) {
        notificationsToCreate.push({
          fromEmployeeId: cancelledSession.physioId,
          toEmployeeId: cancelledSession.physioId,
          message: `Your session ${cancelledSession.sessionCode} for ${
            patient?.patientName || "Patient"
          } on ${new Date(cancelledSession.sessionDate).toLocaleDateString(
            "en-IN",
          )} has been marked as cancelled.`,
          type: "Session-Cancellation",
          status: "unseen",
          meta: commonMeta,
        });
      }

      // ✅ Additional petrol notification only if petrol claimed
      if (isPetrolClaimed) {
        for (const superAdmin of superAdminEmployees) {
          notificationsToCreate.push({
            fromEmployeeId: cancelledSession.physioId,
            toEmployeeId: superAdmin._id,
            message: `Petrol allowance approval needed for cancelled session ${
              cancelledSession.sessionCode
            } of ${patient?.patientName || "Patient"} on ${new Date(
              cancelledSession.sessionDate,
            ).toLocaleDateString("en-IN")}. Reason: ${
              cancelledSession.sessionCancelReason || "No reason provided"
            }. Claimed KMs: ${cancelledSession.cancelledKms || 0}.`,
            type: "Petrol-Allowance",
            status: "unseen",
            meta: commonMeta,
          });
        }
      }

      const savedNotifications = await Notification.insertMany(
        notificationsToCreate,
      );

      if (io && savedNotifications.length > 0) {
        savedNotifications.forEach((notification) => {
          if (notification.toEmployeeId) {
            io.to(notification.toEmployeeId.toString()).emit(
              "receiveNotification",
              notification,
            );
          }
        });
      }
    } catch (notifyErr) {
      console.error("Cancellation Notification Error:", notifyErr.message);
    }

    return res.status(200).json({
      message: "Session cancelled and notifications sent successfully.",
      cancelledSession,
    });
  } catch (error) {
    console.error("SessionCancel Error:", error);
    if (!res.headersSent) {
      return res.status(500).json({ message: error.message });
    }
  }
};

// exports.SessionEnd = async (req, res) => {
//   const mongooseSession = await mongoose.startSession();
//   mongooseSession.startTransaction();

//   try {
//     const {
//       _id,
//       machineId,
//       sessionFeedbackPros,
//       redFlags,
//       targetArea,
//       modeOfExercise,
//       modalities,
//       modalitiesList,
//       sessionToTime,
//       action,
//     } = req.body;

//     // 1) Prepare Session Update Object
//     let sessionUpdateData = {
//       sessionFeedbackPros,
//       redFlags,
//       targetArea,
//       modeOfExercise,
//       modalities,
//       modalitiesList,
//       sessionToTime,
//     };
//     if (machineId) sessionUpdateData.machineId = machineId;

//     // 2) Resolve Status
//     const Status = await SessionStatus.findOne({
//       sessionStatusName: action,
//     }).session(mongooseSession);

//     if (!Status) throw new Error("Session Status is not found");
//     sessionUpdateData.sessionStatusId = Status._id;

//     // 3) Update Session
//     const session = await Session.findByIdAndUpdate(
//       _id,
//       { $set: sessionUpdateData },
//       { new: true, runValidators: true, session: mongooseSession },
//     );

//     if (!session) throw new Error("Session not found");

//     // 4) Fetch Patient and FeesType
//     const patient = await Patient.findById(session.patientId)
//       .populate("FeesTypeId")
//       .session(mongooseSession);

//     if (!patient) throw new Error("Patient not found");

//     // ------------------------------
//     // 5) PER MONTH BILLING (AT SESSION 26)
//     // ------------------------------
//     if (
//       patient.FeesTypeId?.feesTypeName === "PerMonth" &&
//       Number(session.sessionCount) === 26
//     ) {
//       const today = new Date();
//       const currentMonth = today.getMonth() + 1; // 1-12
//       const currentYear = today.getFullYear();

//       const totalBilledAmount = Number(patient.feeAmount || 0);

//       // --- DYNAMIC DATE RANGE CALCULATION ---
//       // We look for all unbilled sessions + the current session to find the true range
//       const sessionRange = await Session.aggregate([
//         {
//           $match: {
//             patientId: patient._id,
//             isBilled: false,
//             // Include current session if it's not marked billed yet
//             $or: [{ _id: session._id }, { isBilled: false }],
//           },
//         },
//         {
//           $group: {
//             _id: null,
//             firstDate: { $min: "$sessionDate" },
//             lastDate: { $max: "$sessionDate" },
//           },
//         },
//       ]).session(mongooseSession);

//       // Fallback to start/end of month if aggregation finds nothing (failsafe)
//       const startDate =
//         sessionRange.length > 0
//           ? sessionRange[0].firstDate
//           : new Date(today.getFullYear(), today.getMonth(), 1);
//       const toDate =
//         sessionRange.length > 0 ? sessionRange[0].lastDate : new Date();

//       // debitDoc (old logic)
//       const debitDoc = await Debit.findOne({
//         patientId: patient._id,
//         DebitAmount: { $gt: 0 },
//       })
//         .sort({ DebitDate: 1 })
//         .session(mongooseSession);

//       // monthly aggregation
//       const monthlyAdvanceRecord = await Debit.aggregate([
//         {
//           $match: {
//             patientId: patient._id,
//             DebitMonth: currentMonth,
//             DebitYear: currentYear,
//           },
//         },
//         { $group: { _id: null, total: { $sum: "$DebitAmount" } } },
//       ]).session(mongooseSession);

//       const availableMonthlyAdvance =
//         monthlyAdvanceRecord.length > 0
//           ? Number(monthlyAdvanceRecord[0].total)
//           : 0;

//       const deductedFromAdvance = Math.min(
//         availableMonthlyAdvance,
//         totalBilledAmount,
//       );
//       const netBilledAmount = totalBilledAmount - deductedFromAdvance;

//       let paymentStatus = "Pending";
//       if (netBilledAmount === 0 && totalBilledAmount > 0)
//         paymentStatus = "Paid";
//       else if (deductedFromAdvance > 0) paymentStatus = "Partially Paid";

//       if (debitDoc && deductedFromAdvance > 0) {
//         debitDoc.DebitAmount = Number(
//           (Number(debitDoc.DebitAmount || 0) - deductedFromAdvance).toFixed(2),
//         );
//         debitDoc.DebitDate = new Date();
//         await debitDoc.save({ session: mongooseSession });
//       }

//       await Bill.create(
//         [
//           {
//             patientId: patient._id,
//             physioId: session.physioId,
//             paymentType: "Partial Payment",
//             paymentStatus,
//             TotalBilledAmount: totalBilledAmount,
//             DeductedFromAdvance: deductedFromAdvance,
//             NetBilledAmount: netBilledAmount,
//             startDate: startDate, // Updated to use dynamic range
//             ToDate: toDate, // Updated to use dynamic range
//             month: today.toLocaleString("default", { month: "long" }),
//             year: currentYear,
//             TotalSessionCount: session.sessionCount,
//           },
//         ],
//         { session: mongooseSession },
//       );

//       await Session.updateMany(
//         {
//           patientId: patient._id,
//           // Update sessions that fall within the specific range identified
//           sessionDate: { $gte: startDate, $lte: toDate },
//           isBilled: false,
//         },
//         { $set: { isBilled: true } },
//         { session: mongooseSession },
//       );

//       await triggerRoleNotifications(
//         req,
//         session,
//         patient,
//         "Monthly-Bill-Alert",
//       );
//     }

//     // ------------------------------
//     // 6) Red Flags & Review Logic
//     // ------------------------------
//     if (redFlags && Array.isArray(redFlags) && redFlags.length > 0) {
//       const formattedRedFlags = redFlags.map((r) => ({
//         redFlagId: new mongoose.Types.ObjectId(r.redFlagId?._id || r.redFlagId),
//       }));

//       const reviewTypeDefault = await ReviewType.findOne({
//         reviewTypeName: "RedFlags",
//       }).session(mongooseSession);

//       const reviewStatusDefault = await ReviewStatus.findOne({
//         reviewStatusName: "Pending",
//       }).session(mongooseSession);

//       if (reviewTypeDefault && reviewStatusDefault) {
//         const newReview = await Review.create(
//           [
//             {
//               patientId: session.patientId,
//               physioId: session.physioId,
//               reviewDate: session.sessionDate,
//               sessionId: session._id,
//               reviewTypeId: reviewTypeDefault._id,
//               redFlags: formattedRedFlags,
//               reviewStatusId: reviewStatusDefault._id,
//             },
//           ],
//           { session: mongooseSession },
//         );

//         await triggerRoleNotifications(
//           req,
//           session,
//           patient,
//           "Red-Flag-Alert",
//           newReview[0]._id,
//         );
//       }
//     }

//     // ------------------------------
//     // 7) Petrol Allowance Logic
//     // ------------------------------
//     const kmsToAdd =
//       Number(patient.visitOrder) === 1
//         ? Number(patient.KmsfromHub || 0)
//         : Number(patient.kmsFromPrevious || 0);

//     const allowanceDate = new Date(session.sessionDate);
//     allowanceDate.setHours(12, 0, 0, 0);

//     await PetrolAllowance.findOneAndUpdate(
//       { physioId: session.physioId, date: allowanceDate },
//       {
//         $setOnInsert: {
//           physioId: session.physioId,
//           date: allowanceDate,
//           completedKms: 0,
//           canceledKms: 0,
//           manualKms: 0,
//           finalDailyKms: 0,
//           amountPerKm: 0,
//           totalAmount: 0,
//           status: "Pending",
//         },
//       },
//       { new: true, upsert: true, session: mongooseSession },
//     );

//     await PetrolAllowance.findOneAndUpdate(
//       { physioId: session.physioId, date: allowanceDate },
//       { $inc: { completedKms: kmsToAdd, finalDailyKms: kmsToAdd } },
//       { new: true, session: mongooseSession },
//     );

//     const updated = await PetrolAllowance.findOneAndUpdate(
//       {
//         physioId: session.physioId,
//         date: allowanceDate,
//         "summary.patientId": session.patientId,
//       },
//       {
//         $inc: { "summary.$.travelKm": kmsToAdd },
//         $set: {
//           "summary.$.type": "Completed",
//           "summary.$.sessionId": session._id,
//         },
//       },
//       { new: true, session: mongooseSession },
//     );

//     if (!updated) {
//       await PetrolAllowance.findOneAndUpdate(
//         { physioId: session.physioId, date: allowanceDate },
//         {
//           $push: {
//             summary: {
//               patientId: session.patientId,
//               travelKm: kmsToAdd,
//               type: "Completed",
//               sessionId: session._id,
//             },
//           },
//         },
//         { new: true, session: mongooseSession },
//       );
//     }

//     await mongooseSession.commitTransaction();

//     return res.status(200).json({
//       success: true,
//       message: "Session ended successfully",
//       data: session,
//     });
//   } catch (error) {
//     await mongooseSession.abortTransaction();
//     console.error("❌ SessionEnd Failed. Transaction Aborted:", error);

//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   } finally {
//     mongooseSession.endSession();
//   }
// };

exports.SessionEnd = async (req, res) => {
  const mongooseSession = await mongoose.startSession();
  mongooseSession.startTransaction();

  let session; // Keep session reference for petrol allowance
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

    // 1) Prepare Session Update Object
    let sessionUpdateData = {
      sessionFeedbackPros,
      redFlags,
      targetArea,
      modeOfExercise,
      modalities,
      modalitiesList,
      sessionToTime,
    };
    const counter = await Counter.findOneAndUpdate(
      { _id: "invoiceNo" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );
    if (machineId) sessionUpdateData.machineId = machineId;

    // 2) Resolve Status
    const Status = await SessionStatus.findOne({
      sessionStatusName: action,
    }).session(mongooseSession);
    if (!Status) throw new Error("Session Status is not found");
    sessionUpdateData.sessionStatusId = Status._id;

    // 3) Update Current Session
    session = await Session.findByIdAndUpdate(
      _id,
      { $set: sessionUpdateData },
      { new: true, runValidators: true, session: mongooseSession },
    );
    if (!session) throw new Error("Session not found");

    // ===== MONTHLY SESSION COUNT UPDATE =====
    if (Status.sessionStatusName === "Completed") {
      const sessionDateObj = new Date(session.sessionDate);

      const monthStart = new Date(
        sessionDateObj.getFullYear(),
        sessionDateObj.getMonth(),
        1,
      );

      const monthEnd = new Date(
        sessionDateObj.getFullYear(),
        sessionDateObj.getMonth() + 1,
        1,
      );

      const completedStatus = await SessionStatus.findOne({
        sessionStatusName: "Completed",
      }).session(mongooseSession);

      const monthlyCompletedCount = await Session.countDocuments({
        patientId: session.patientId,
        cycleId: session.cycleId,
        sessionDate: { $gte: monthStart, $lt: monthEnd },
        sessionStatusId: completedStatus._id,
      }).session(mongooseSession);

      await Session.updateOne(
        { _id: session._id },
        { $set: { monthlySessionCount: monthlyCompletedCount } },
        { session: mongooseSession },
      );
    }
    // 4) Fetch Patient and FeesType
    const patient = await Patient.findById(session.patientId)
      .populate("FeesTypeId")
      .session(mongooseSession);
    if (!patient) throw new Error("Patient not found");

    // ------------------------------
    // 5) PER MONTH BILLING (EVERY 26 UNBILLED SESSIONS)
    // ------------------------------
    if (patient.FeesTypeId?.feesTypeName === "PerMonth") {
      const unbilledData = await Session.aggregate([
        {
          $match: {
            patientId: patient._id,
            isBilled: false,
            sessionStatusId: Status._id,
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            firstSessionDate: { $min: "$sessionDate" },
            lastSessionDate: { $max: "$sessionDate" },
            sessionIds: { $push: "$_id" },
          },
        },
      ]).session(mongooseSession);

      const unbilledCount = unbilledData.length > 0 ? unbilledData[0].count : 0;

      if (unbilledCount > 0 && unbilledCount % 26 === 0) {
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();
        const totalBilledAmount = Number(patient.feeAmount || 0);

        const startDate = unbilledData[0].firstSessionDate;
        const toDate = unbilledData[0].lastSessionDate;
        const sessionIdsToBill = unbilledData[0].sessionIds;

        const debitDoc = await Debit.findOne({
          patientId: patient._id,
          DebitAmount: { $gt: 0 },
        })
          .sort({ DebitDate: 1 })
          .session(mongooseSession);

        const monthlyAdvanceRecord = await Debit.aggregate([
          {
            $match: {
              patientId: patient._id,
              DebitMonth: currentMonth,
              DebitYear: currentYear,
            },
          },
          { $group: { _id: null, total: { $sum: "$DebitAmount" } } },
        ]).session(mongooseSession);

        const availableMonthlyAdvance =
          monthlyAdvanceRecord.length > 0
            ? Number(monthlyAdvanceRecord[0].total)
            : 0;

        const deductedFromAdvance = Math.min(
          availableMonthlyAdvance,
          totalBilledAmount,
        );
        const netBilledAmount = totalBilledAmount - deductedFromAdvance;

        let paymentStatus = "Pending";
        if (netBilledAmount === 0 && totalBilledAmount > 0)
          paymentStatus = "Paid";
        else if (deductedFromAdvance > 0) paymentStatus = "Partially Paid";

        if (debitDoc && deductedFromAdvance > 0) {
          debitDoc.DebitAmount = Number(
            (Number(debitDoc.DebitAmount || 0) - deductedFromAdvance).toFixed(
              2,
            ),
          );
          debitDoc.DebitDate = new Date();
          await debitDoc.save({ session: mongooseSession });
        }

        const invoiceNo = `HNI-${String(counter.seq).padStart(6, "0")}`;

        await Bill.create(
          [
            {
              patientId: patient._id,
              physioId: session.physioId,
              paymentType: "Partial Payment",
              paymentStatus,
              invoiceNo,
              TotalBilledAmount: totalBilledAmount,
              DeductedFromAdvance: deductedFromAdvance,
              NetBilledAmount: netBilledAmount,
              startDate: startDate,
              ToDate: toDate,
              month: today.toLocaleString("default", { month: "long" }),
              year: currentYear,
              TotalSessionCount: unbilledCount,
            },
          ],
          { session: mongooseSession },
        );

        await Session.updateMany(
          { _id: { $in: sessionIdsToBill } },
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
    }

    // ------------------------------
    // 6) Red Flags & Review Logic
    // ------------------------------
    if (redFlags && Array.isArray(redFlags) && redFlags.length > 0) {
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

        await triggerRoleNotifications(
          req,
          session,
          patient,
          "Red-Flag-Alert",
          newReview[0]._id,
        );
      }
    }

    await mongooseSession.commitTransaction();
  } catch (error) {
    await mongooseSession.abortTransaction();
    console.error("❌ SessionEnd Failed. Transaction Aborted:", error);
  } finally {
    mongooseSession.endSession();
  }

  // -------------------------
  // PetrolAllowance runs always if session is completed
  // -------------------------
  try {
    if (session) {
      const completedStatus = await SessionStatus.findById(
        session.sessionStatusId,
      );
      if (completedStatus?.sessionStatusName === "Completed") {
        const patient = await Patient.findById(session.patientId);
        const kmsToAdd =
          Number(patient.visitOrder) === 1
            ? Number(patient.KmsfromHub || 0)
            : Number(patient.kmsFromPrevious || 0);

        const allowanceDate = new Date(session.sessionDate);
        allowanceDate.setHours(12, 0, 0, 0);

        // Initial upsert
        await PetrolAllowance.findOneAndUpdate(
          { physioId: session.physioId, date: allowanceDate },
          {
            $setOnInsert: {
              physioId: session.physioId,
              date: allowanceDate,
              completedKms: 0,
              canceledKms: 0,
              manualKms: 0,
              finalDailyKms: 0,
              amountPerKm: 0,
              totalAmount: 0,
              status: "Pending",
            },
          },
          { new: true, upsert: true },
        );

        // Increment Kms
        await PetrolAllowance.findOneAndUpdate(
          { physioId: session.physioId, date: allowanceDate },
          { $inc: { completedKms: kmsToAdd, finalDailyKms: kmsToAdd } },
          { new: true },
        );

        const updated = await PetrolAllowance.findOneAndUpdate(
          {
            physioId: session.physioId,
            date: allowanceDate,
            "summary.patientId": session.patientId,
          },
          {
            $inc: { "summary.$.travelKm": kmsToAdd },
            $set: {
              "summary.$.type": "Completed",
              "summary.$.sessionId": session._id,
            },
          },
          { new: true },
        );

        if (!updated) {
          await PetrolAllowance.findOneAndUpdate(
            { physioId: session.physioId, date: allowanceDate },
            {
              $push: {
                summary: {
                  patientId: session.patientId,
                  travelKm: kmsToAdd,
                  type: "Completed",
                  sessionId: session._id,
                },
              },
            },
            { new: true, upsert: true },
          );
        }

        console.log("✅ PetrolAllowance calculated successfully");
      }
    }
  } catch (error) {
    console.error("❌ PetrolAllowance calculation failed:", error);
  }

  return res.status(200).json({
    success: true,
    message:
      "Session processed successfully. PetrolAllowance calculated if completed.",
    data: session,
  });
};

exports.getSCRStats = async (req, res) => {
  try {
    const { year } = req.query;
    const selectedYear = parseInt(year) || new Date().getFullYear();

    const stats = await Session.aggregate([
      {
        $match: {
          sessionDate: {
            $gte: new Date(`${selectedYear}-01-01T00:00:00.000Z`),
            $lte: new Date(`${selectedYear}-12-31T23:59:59.999Z`),
          },
        },
      },
      {
        $lookup: {
          from: "sessionstatuses", // collection name for statuses
          localField: "sessionStatusId",
          foreignField: "_id",
          as: "statusObj",
        },
      },
      {
        $unwind: {
          path: "$statusObj",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: { $month: "$sessionDate" },
          scheduled: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [
                { $eq: ["$statusObj.sessionStatusName", "Completed"] },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          month: "$_id",
          scheduled: 1,
          completed: 1,
          scr: {
            $cond: [
              { $gt: ["$scheduled", 0] },
              { $multiply: [{ $divide: ["$completed", "$scheduled"] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { month: 1 } },
    ]);

    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
exports.forceBillFirst26Sessions = async (req, res) => {
  try {
    const { patientId } = req.body;

    if (!patientId) {
      return res.status(400).json({ message: "Patient ID is required." });
    }

    // 1. Get the 'Completed' status ID to ensure we only bill actual treatments
    const completedStatus = await SessionStatus.findOne({
      sessionStatusName: { $regex: /completed/i },
    });

    if (!completedStatus) {
      return res
        .status(404)
        .json({ message: "Completed session status not found." });
    }

    // 2. Find the first 26 completed sessions (ordered by date)
    // We don't filter by isBilled here; we just take the top 26 oldest records.
    const sessionsToUpdate = await Session.find({
      patientId: patientId,
      sessionStatusId: completedStatus._id,
    })
      .sort({ sessionDate: 1 })
      .limit(26)
      .select("_id"); // We only need the IDs for the update

    if (sessionsToUpdate.length === 0) {
      return res
        .status(200)
        .json({ message: "No completed sessions found to bill." });
    }

    const ids = sessionsToUpdate.map((s) => s._id);

    // 3. Force isBilled to true for these specific IDs
    const result = await Session.updateMany(
      { _id: { $in: ids } },
      { $set: { isBilled: true } },
    );

    res.status(200).json({
      success: true,
      message: `Updated ${result.modifiedCount} sessions to billed status (Targeted: ${ids.length}).`,
      totalTargeted: ids.length,
    });
  } catch (error) {
    console.error("Force Billing Error:", error);
    res.status(500).json({ message: error.message });
  }
};

async function triggerRoleNotifications(
  req,
  session,
  patient,
  type,
  reviewId = null,
) {
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
      message:
        type === "Monthly-Bill-Alert"
          ? `Patient ${patient.patientName} reached 26 sessions. Bill generated.`
          : `Red flags added for patient ${patient.patientName}.`,
      type,
      meta: {
        PatientId: patient._id,
        SessionId: session._id,
        ReviewId: reviewId,
      },
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
// exports.cancelAllSessionsForPhysioLeave = async (req, res) => {
//   try {
//     const { physioId, sessionDate, cancelledKms = 0 } = req.body;

//     if (!physioId || !sessionDate) {
//       return res.status(400).json({
//         success: false,
//         message: "physioId and sessionDate are required",
//       });
//     }

//     const start = new Date(sessionDate);
//     start.setHours(0, 0, 0, 0);

//     const end = new Date(sessionDate);
//     end.setHours(23, 59, 59, 999);

//     const canceledStatus = await SessionStatus.findOne({
//       sessionStatusName: "Canceled",
//     });

//     if (!canceledStatus) {
//       return res.status(404).json({
//         success: false,
//         message: "Canceled session status not found",
//       });
//     }

//     const sessions = await Session.find({
//       physioId: new mongoose.Types.ObjectId(physioId),
//       sessionDate: { $gte: start, $lte: end },
//       sessionStatusId: { $ne: canceledStatus._id },
//     });

//     if (!sessions.length) {
//       return res.status(200).json({
//         success: true,
//         message: "No active sessions found to cancel",
//         updatedCount: 0,
//       });
//     }

//     const sessionIds = sessions.map((s) => s._id);

//     await Session.updateMany(
//       { _id: { $in: sessionIds } },
//       {
//         $set: {
//           sessionStatusId: canceledStatus._id,
//           cancelledReason: "Physio Leave",
//           cancelledKms: Number(cancelledKms) || 0,
//           action: "Canceled",
//         },
//       },
//     );

//     return res.status(200).json({
//       success: true,
//       message: "All today sessions canceled due to physio leave",
//       updatedCount: sessionIds.length,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

exports.reassignTodayCancelledSession = async (req, res) => {
  try {
    const { patientId, oldPhysioId, newPhysioId, sessionDate, sessionTime } =
      req.body;

    if (
      !patientId ||
      !oldPhysioId ||
      !newPhysioId ||
      !sessionDate ||
      !sessionTime
    ) {
      return res.status(400).json({
        success: false,
        message:
          "patientId, oldPhysioId, newPhysioId, sessionDate and sessionTime are required",
      });
    }

    const start = new Date(sessionDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(sessionDate);
    end.setHours(23, 59, 59, 999);

    const scheduledStatus = await SessionStatus.findOne({
      sessionStatusName: "Scheduled",
    });

    if (!scheduledStatus) {
      return res.status(404).json({
        success: false,
        message: "Scheduled status not found",
      });
    }

    const session = await Session.findOne({
      patientId: new mongoose.Types.ObjectId(patientId),
      physioId: new mongoose.Types.ObjectId(oldPhysioId),
      sessionDate: { $gte: start, $lte: end },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found for selected patient and date",
      });
    }

    session.physioId = new mongoose.Types.ObjectId(newPhysioId);
    session.sessionTime = sessionTime;
    session.sessionStatusId = scheduledStatus._id;
    session.sessionCancelReason = "";
    session.sessionFeedbackCons = "";
    session.cancelledKms = 0;
    session.action = "Scheduled";

    await session.save();

    return res.status(200).json({
      success: true,
      message: "Session reassigned and changed to Scheduled",
      data: session,
    });
  } catch (error) {
    console.error("reassignTodayCancelledSession error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
exports.revertCompletedSession = async (req, res) => {
  try {
    const { _id } = req.body;

    const session = await Session.findById(_id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    // revert status
    session.sessionStatusId = "691ecb36b87c5c57dead47a7"; // or scheduled status id

    // clear feedback
    session.sessionFeedbackPros = "";
    session.sessionFeedbackCons = "";
    session.sessionCancelReason = "";

    await session.save();

    res.status(200).json({
      success: true,
      message: "Session reverted successfully",
      session,
    });
  } catch (error) {
    console.error("Revert session error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
exports.getSessionsByMonthYear = async (req, res) => {
  try {
    const { month, year, physioId, storedRole } = req.body;

    if (!month || !year) {
      return res.status(400).json({
        message: "Month and Year are required",
      });
    }

    // ✅ Convert month (1-12) → JS month index (0-11)
    const monthIndex = Number(month) - 1;
    const fullYear = Number(year);

    // ✅ Start of month
    const startDate = new Date(Date.UTC(fullYear, monthIndex, 1, 0, 0, 0));

    // ✅ End of month
    const endDate = new Date(Date.UTC(fullYear, monthIndex + 1, 0, 23, 59, 59));

    console.log("START DATE:", startDate);
    console.log("END DATE:", endDate);

    // ---------------- QUERY ----------------
    const query = {
      sessionDate: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    // ✅ Role-based filtering
    if (storedRole === "Physio" && physioId) {
      query.physioId = physioId;
    }

    // ---------------- FETCH ----------------
    const sessions = await Session.find(query)
      .populate("physioId")
      .populate("patientId")
      .populate("sessionStatusId")
      .lean();
    console.log(sessions, "sessions");
    return res.status(200).json({
      message: "Sessions fetched successfully",
      data: sessions,
    });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};
