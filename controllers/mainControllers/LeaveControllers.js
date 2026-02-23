const mongoose = require("mongoose");
const LeaveModel = require("../../model/masterModels/Leave");

exports.markLeave = async (req, res) => {
  try {
    const { physioId, LeaveDate, LeaveMode } = req.body;

    if (!physioId || !LeaveDate || !LeaveMode) {
      return res.status(400).json({
        message: "physioId, date, and leaveMode are required",
      });
    }

    const date = new Date(LeaveDate);
    date.setHours(0, 0, 0, 0);
    const existingLeave = await LeaveModel.findOne({
      physioId,
      LeaveDate: date,
    });

    if (existingLeave) {
      return res.status(400).json({
        success: false,
        message: "Already leave exists for this physio with this date",
      });
    }
    const savedLeave = await LeaveModel.create({
      physioId,
      LeaveDate: date,
      LeaveMode,
      PaidLeave: false,
    });

    const populated = await LeaveModel.findById(savedLeave._id).populate(
      "physioId",
      "physioName",
    );

    return res.status(201).json({
      success: true,
      message: "Leave marked successfully",
      data: populated,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.saveLeavePlan = async (req, res) => {
  try {
    const { physioId, LeaveDate, LeaveMode, SessionGenerateForLeave } =
      req.body;

    if (!physioId || !LeaveDate) {
      return res
        .status(400)
        .json({ success: false, message: "physioId and LeaveDate required" });
    }

    const plan = Array.isArray(SessionGenerateForLeave)
      ? SessionGenerateForLeave
      : [SessionGenerateForLeave];

    const updated = await LeaveModel.findOneAndUpdate(
      { physioId, LeaveDate: new Date(LeaveDate) },
      {
        $set: {
          LeaveMode: LeaveMode || "Full Day",
          SessionGenerateForLeave: plan,
          isActive: true,
        },
        $setOnInsert: {
          PaidLeave: false,
        },
      },
      { new: true, upsert: true },
    ).populate("physioId", "physioName");

    return res.json({
      success: true,
      message: "Future sessions saved successfully",
      data: updated,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllLeave = async (req, res) => {
  try {
    const { LeaveDate, isActive } = req.body;
    const filter = {};

    // Filter by LeaveDate if provided
    if (LeaveDate) {
      const date = new Date(LeaveDate);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      // Filter for that exact day
      filter.LeaveDate = {
        $gte: date,
        $lt: nextDate,
      };
    }

    if (isActive !== undefined) {
      filter.isActive = isActive;
    }
    const Leaves = await LeaveModel.find(filter)
      .populate("physioId", "physioName")
      .populate({
        path: "SessionGenerateForLeave.patientId",
        select: "patientName",
      })
      .populate({
        path: "SessionGenerateForLeave.Re_Assign",
        select: "physioName",
      })
      .sort({ LeaveDate: -1 });

    res.status(200).json({
      totalLeaves: Leaves.length,
      Leaves,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateLeavePaidStatus = async (req, res) => {
  try {
    const { _id, PaidLeave } = req.body;

    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Invalid Leave ID" });
    }

    const paid = PaidLeave === true || PaidLeave === "true";

    const updated = await LeaveModel.findByIdAndUpdate(
      _id,
      { $set: { PaidLeave: paid } },
      { new: true },
    );

    if (!updated) {
      return res.status(404).json({ message: "Leave not found" });
    }

    return res.status(200).json({
      success: true,
      message: `Leave marked as ${updated.PaidLeave ? "PAID" : "UNPAID"}`,
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
