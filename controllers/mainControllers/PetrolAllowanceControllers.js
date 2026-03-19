const mongoose = require("mongoose");
const Petrol = require("../../model/masterModels/PetrolAllowance");

// Get all Petrol
// exports.getAllPetrol = async (req, res) => {
//   try {
//     const petrol = await Petrol.find()
//       .populate("physioId", "physioName")
//       .populate("summary.patientId", "patientName");
//     if (!petrol) {
//       res.status(400).json({ message: "petrol is not found" });
//     }

//     res.status(200).json(petrol);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };
exports.getAllPetrol = async (req, res) => {
  try {
    const { from, to } = req.body;

    const matchStage = {};
    if (from && to) {
      matchStage.date = {
        $gte: new Date(from),
        $lte: new Date(to),
      };
    }

    const petrolData = await Petrol.aggregate([
      { $match: matchStage },
      // 1. Join with Physio
      {
        $lookup: {
          from: "physios",
          localField: "physioId",
          foreignField: "_id",
          as: "physioInfo",
        },
      },
      { $unwind: "$physioInfo" },

      // 2. Unwind summary to get access to individual patient kms
      { $unwind: { path: "$summary", preserveNullAndEmptyArrays: true } },

      // 3. Lookup Patient Details
      {
        $lookup: {
          from: "patients",
          localField: "summary.patientId",
          foreignField: "_id",
          as: "patientInfo",
        },
      },
      { $unwind: { path: "$patientInfo", preserveNullAndEmptyArrays: true } },

      // 4. Group by each Daily Record ID to calculate the CORRECT daily sum
      {
        $group: {
          _id: "$_id",
          physioId: { $first: "$physioId" },
          physioName: { $first: "$physioInfo.physioName" },
          date: { $first: "$date" },
          status: { $first: "$status" },
          // DYNAMIC CALCULATION: Summing the patient kms for this specific day
          calculatedDailyKm: { $sum: { $ifNull: ["$summary.travelKm", 0] } },
          patientDetails: {
            $push: {
              $cond: [
                { $gt: ["$summary.patientId", null] },
                {
                  patientId: "$summary.patientId",
                  patientName: "$patientInfo.patientName",
                  km: "$summary.travelKm",
                },
                "$$REMOVE",
              ],
            },
          },
        },
      },

      // 5. Group by Physio to calculate the Grand Total and nest the logs
      {
        $group: {
          _id: "$physioId",
          physioId: { $first: "$physioId" },
          physioName: { $first: "$physioName" },
          // Summing the correctly calculated daily KMs
          grandTotalPhysioKm: { $sum: "$calculatedDailyKm" },
          patients: {
            $push: {
              dailyLogs: {
                date: "$date",
                finalDailyKms: "$calculatedDailyKm", // Now returns 39 instead of 23
                status: "$status",
                patientDetails: "$patientDetails",
              },
            },
          },
        },
      },
      { $sort: { physioName: 1 } },
    ]);

    res.status(200).json(petrolData);
  } catch (error) {
    console.error("Aggregation Error:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.updateManualKms = async (req, res) => {
  try {
    const { petrolAllowanceId, amount } = req.body;

    if (!petrolAllowanceId || typeof amount !== "number") {
      return res
        .status(400)
        .json({ message: "petrolAllowanceId & amount required" });
    }

    const doc = await Petrol.findById(petrolAllowanceId);
    if (!doc)
      return res.status(404).json({ message: "PetrolAllowance not found" });

    // ✅ update fields
    doc.manualKms = Number(doc.manualKms || 0) + amount;
    doc.finalDailyKms = Number(doc.finalDailyKms || 0) + amount;

    await doc.save();

    return res.status(200).json({
      message: "Manual kms updated",
      data: {
        _id: doc._id,
        manualKms: doc.manualKms,
        finalDailyKms: doc.finalDailyKms,
      },
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

exports.ApprovePetrol = async (req, res) => {
  try {
    const petrol = await Petrol.updateMany({}, { status: "Approved" });
    if (petrol.nModified === 0) {
      res.status(400).json({ message: "No petrol records were updated" });
    }
    res.status(200).json({ message: "Petrol allowance approved successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
