const mongoose = require("mongoose");
const Bill = require("../../model/masterModels/Bill");
// Create a new Patient
exports.createBill = async (req, res) => {
  try {
    const {
      patientId,
      physioId,
      startDate,
      ToDate,
      ratePerSession,
      totalAmount,
      TotalSessionCount,
    } = req.body;
    // Check for duplicates (if needed)
    const existingBill = await Bill.findOne({
      patientId: patientId,
    });
    if (existingBill) {
      return res
        .status(400)
        .json({ message: "Bill with this Patient  already exists" });
    }
    // Create and save the Patient
    const bill = new Bill({
      patientId,
      physioId,
      startDate,
      ToDate,
      ratePerSession,
      totalAmount,
      TotalSessionCount,
    });
    await bill.save();

    res.status(200).json({
      message: "Bill  created successfully",
      data: bill._id,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Get allConsultation
exports.getAllBill = async (req, res) => {
  try {
    const bills = await Bill.find()
      .populate("physioId", "physioName")
      .populate("patientId");
    if (!bills) {
      return res.status(400).json({ message: "Bill not found" });
    }

    res.status(200).json(bills);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a consultate
exports.deleteBill = async (req, res) => {
  try {
    const { _id } = req.body;

    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const bill = await Bill.findByIdAndDelete(_id);

    if (!bill) {
      return res.status(400).json({ message: "Bill not found" });
    }

    res.status(200).json({ message: "Bill deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
