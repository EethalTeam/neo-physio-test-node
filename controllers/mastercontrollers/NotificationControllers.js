// const Notification = require("../../models/masterModels/Notification");
const Notification = require("../../model/masterModels/Notification");
// const Group = require("../../models/masterModels/Group"); // Your group schema
// const LeaveRequest = require("../../models/masterModels/LeaveRequest");
// const PermissionRequest = require("../../models/masterModels/Permissions");
// const Task = require('../../models/masterModels/Task')
const mongoose = require("mongoose");
const Session = require("../../model/masterModels/Session");
const Patient = require("../../model/masterModels/Patient");
const PetrolAllowance = require("../../model/masterModels/PetrolAllowance");
const SessionStatus = require("../../model/masterModels/SessionStatus");
// Create a notification
exports.createNotification = async (req, res) => {
  try {
    const { unitId, message, type, fromEmployeeId, toEmployeeId, meta } =
      req.body;

    if (!unitId || !message || !type || !fromEmployeeId) {
      return res.status(400).json({
        message: "unitId, message, type, and fromEmployeeId are required.",
      });
    }

    // Determine default status
    let status = "unseen";
    // if (type === "chat-message" || type === "group-chat-message") status = "unseen";
    // else if (type === "leave-request" || type === "permission-request") status = "unseen";
    // else status = "seen"; // system announcements etc.

    const notification = new Notification({
      // unitId,
      message,
      type,
      fromEmployeeId,
      toEmployeeId: toEmployeeId || null,
      // groupId: groupId || null,
      status,
      meta: meta || {},
    });

    await notification.save();

    // Emit real-time notification via socket
    const io = req.app.get("socketio"); // access Socket.IO instance
    if (io) {
      if (toEmployeeId) {
        io.to(toEmployeeId.toString()).emit(
          "receiveNotification",
          notification,
        );
      }
      // else if (groupId) {
      //   const group = await Group.findById(groupId).populate("members", "_id");
      //   group.members.forEach(member => {
      //     if (member._id.toString() !== fromEmployeeId.toString()) {
      //       io.to(member._id.toString()).emit("receiveNotification", notification);
      //     }
      //   });
      // }
    }

    res.status(201).json({
      message: "Notification created successfully.",
      data: notification,
    });
  } catch (error) {
    console.error("Error saving notification:", error.message);
    res.status(500).json({
      message: "Failed to save notification.",
      error: error.message,
    });
  }
};

// Fetch notifications for an employee (direct + group)
exports.getNotificationsByEmployee = async (req, res) => {
  try {
    const { employeeId } = req.body;

    if (!employeeId) {
      return res.status(400).json({ message: "employeeId is required." });
    }

    const notifications = await Notification.find({
      $or: [
        { toEmployeeId: employeeId },
        // { type: "group-chat-message", "meta.groupMembers": employeeId },
      ],
    }).sort({ createdAt: -1 });

    res.status(200).json({
      message: "Notifications fetched successfully.",
      data: notifications,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error.message);
    res.status(500).json({
      message: "Failed to fetch notifications.",
      error: error.message,
    });
  }
};

// Mark a notification as seen
exports.markAsSeen = async (req, res) => {
  try {
    const { notificationId } = req.body;

    if (!notificationId) {
      return res.status(400).json({ message: "notificationId is required." });
    }

    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { status: "seen" },
      { new: true },
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found." });
    }

    res.status(200).json({
      message: "Notification marked as seen.",
      data: notification,
    });
  } catch (error) {
    console.error("Error updating notification:", error.message);
    res.status(500).json({
      message: "Failed to update notification.",
      error: error.message,
    });
  }
};
exports.updateNotificationStatus = async (req, res) => {
  try {
    const { notificationId, action, physioId, patientId, date } = req.body;
    const io = req.app.get("socketio");

    if (!notificationId || !action) {
      return res
        .status(400)
        .json({ message: "notificationId and action are required." });
    }

    const newStatus = action === "approve" ? "approved" : "rejected";

    // 1) Update original notification status
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { status: newStatus },
      { new: true },
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found." });
    }

    // 2) Petrol allowance logic only on approve
    if (action === "approve") {
      const meta = notification.meta || {};
      const SessionId = meta.SessionId;

      if (!SessionId) {
        return res.status(400).json({ message: "SessionId missing in meta" });
      }

      const cancelledSession =
        await Session.findById(SessionId).populate("patientId");
      if (!cancelledSession) {
        return res.status(404).json({ message: "Session not found" });
      }

      // console.log("APPROVE SESSION", {
      //   SessionId,
      //   petrolAllowanceClaimed: cancelledSession.petrolAllowanceClaimed,
      //   cancelledKms: cancelledSession.cancelledKms,
      //   sessionDate: cancelledSession.sessionDate,
      //   physioId: cancelledSession.physioId,
      // });

      // source of truth
      const petrolAllowanceClaimed = !!cancelledSession.petrolAllowanceClaimed;

      const allowanceDate = new Date(cancelledSession.sessionDate);
      allowanceDate.setHours(12, 0, 0, 0);

      // Ensure PetrolAllowance doc exists for that day (claimed flag update)
      await PetrolAllowance.findOneAndUpdate(
        { physioId: cancelledSession.physioId, date: allowanceDate },
        { $set: { petrolAllowanceClaimed } },
        { new: true, upsert: true },
      );

      // Only if claimed, add kms
      if (petrolAllowanceClaimed) {
        let kmToAdd = Number(cancelledSession.cancelledKms || 0);

        // declare for debug scope
        let firstCompleteSession = null;
        let patientData = null;

        // fallback if cancelledKms not present
        if (!Number.isFinite(kmToAdd) || kmToAdd <= 0) {
          const dayStart = new Date(cancelledSession.sessionDate);
          dayStart.setHours(0, 0, 0, 0);

          const dayEnd = new Date(cancelledSession.sessionDate);
          dayEnd.setHours(23, 59, 59, 999);

          const completedSessionStatus = await SessionStatus.find({
            sessionStatusName: { $in: ["Completed", "Attended"] },
          }).select("_id");

          const statusIds = completedSessionStatus.map((s) => s._id);

          firstCompleteSession = await Session.findOne({
            physioId: cancelledSession.physioId,
            sessionDate: { $gte: dayStart, $lte: dayEnd },
            sessionStatusId: { $in: statusIds },
          })
            .sort({ sessionToTime: 1 })
            .populate("patientId");

          if (firstCompleteSession?.patientId) {
            const p = firstCompleteSession.patientId;

            kmToAdd = Number(
              p.KmsfromHub ?? p.kmsFromHub ?? p.kmsfromHub ?? p.KmsFromHub ?? 0,
            );

            if (!Number.isFinite(kmToAdd) || kmToAdd <= 0) {
              kmToAdd = Number(
                p.kmsFromPrevious ??
                  p.kmsfromPrevious ??
                  p.KmsFromPrevious ??
                  0,
              );
            }
          } else {
            const patientDocId =
              cancelledSession.patientId?._id || cancelledSession.patientId;

            patientData = await Patient.findById(patientDocId);

            if (patientData) {
              kmToAdd =
                patientData.visitOrder == 1
                  ? Number(patientData.KmsfromHub || 0)
                  : Number(patientData.kmsFromPrevious || 0);
            }
          }
        }

        if (!Number.isFinite(kmToAdd) || kmToAdd <= 0) {
          // console.log("KM CALC FAILED", {
          //   SessionId,
          //   cancelledKms: cancelledSession.cancelledKms,
          //   kmToAdd,
          //   firstCompleteSession: firstCompleteSession?._id || null,
          //   firstCompleteKmsFromHub:
          //     firstCompleteSession?.patientId?.KmsfromHub || null,
          //   patientDocKmsFromHub: patientData?.KmsfromHub || null,
          //   patientDockmsFromPrevious: patientData?.kmsFromPrevious || null,
          //   visitOrder: patientData?.visitOrder || null,
          // });

          return res.status(400).json({
            message:
              "Unable to calculate KM (cancelledKms and fallback KM both are 0).",
          });
        }

        // decide which field to increment
        const usedCancelledKm = Number(cancelledSession.cancelledKms || 0) > 0;
        const patientDocId =
          cancelledSession.patientId?._id || cancelledSession.patientId;

        const summaryType = usedCancelledKm ? "Cancelled" : "Completed";

        let paAfterSummaryUpdate = await PetrolAllowance.findOneAndUpdate(
          {
            physioId: cancelledSession.physioId,
            date: allowanceDate,
            "summary.patientId": patientDocId,
            "summary.type": summaryType,
          },
          {
            $inc: { "summary.$.travelKm": kmToAdd },
            $set: { "summary.$.sessionId": cancelledSession._id },
          },
          { new: true },
        );

        if (!paAfterSummaryUpdate) {
          paAfterSummaryUpdate = await PetrolAllowance.findOneAndUpdate(
            { physioId: cancelledSession.physioId, date: allowanceDate },
            {
              $push: {
                summary: {
                  patientId: patientDocId,
                  travelKm: kmToAdd,
                  type: summaryType,
                  sessionId: cancelledSession._id,
                },
              },
            },
            { new: true, upsert: true },
          );
        }
        const updatedPA = await PetrolAllowance.findOneAndUpdate(
          { physioId: cancelledSession.physioId, date: allowanceDate },
          {
            $inc: {
              ...(usedCancelledKm
                ? { cancelledKms: kmToAdd }
                : { completedKms: kmToAdd }),
              finalDailyKms: usedCancelledKm ? -kmToAdd : +kmToAdd,
            },
            $set: { petrolAllowanceClaimed: true },
          },
          { new: true, upsert: true },
        );

        console.log("KM UPDATED SUCCESS", {
          kmToAdd,
          usedCancelledKm,
          petrolAllowanceId: updatedPA?._id,
          savedDate: updatedPA?.date,
          physioId: cancelledSession.physioId,
        });
      }
    }

    // 3) Create response notification back to requester
    const Newnotification = new Notification({
      message: `Your ${notification.type} has been ${newStatus}`,
      type: "general",
      fromEmployeeId: notification.toEmployeeId,
      toEmployeeId: notification.fromEmployeeId || null,
      status: "unseen",
      meta: { patientId, physioId, date },
    });

    await Newnotification.save();

    if (io && notification.fromEmployeeId) {
      io.to(notification.fromEmployeeId.toString()).emit(
        "receiveNotification",
        Newnotification,
      );
    }

    return res.status(200).json({
      message: `Notification updated to ${newStatus}`,
      data: notification,
    });
  } catch (error) {
    console.error("Error updating notification:", error.message);
    return res.status(500).json({
      message: "Failed to update notification.",
      error: error.message,
    });
  }
};
