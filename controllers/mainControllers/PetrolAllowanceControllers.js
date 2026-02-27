const mongoose = require("mongoose");
const Petrol = require("../../model/masterModels/PetrolAllowance");

// Get all Petrol
exports.getAllPetrol = async (req, res) => {
  try {
    const petrol = await Petrol.find().populate("physioId", "physioName");
    if (!petrol) {
      res.status(400).json({ message: "petrol is not found" });
    }

    res.status(200).json(petrol);
  } catch (error) {
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
    console.log(err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

exports.ApprovePetrol = async (req, res) => {
    try {
        const petrol = await Petrol.updateMany({}, { status: "Approved" });
        if (petrol.nModified === 0) {
            res.status(400).json({ message: "No petrol records were updated" })
        }
        res.status(200).json({ message: "Petrol allowance approved successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
