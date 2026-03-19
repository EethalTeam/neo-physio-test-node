const mongoose = require("mongoose");
const Modalities = require("../../model/masterModels/Modalities ");

// Create a new  Modalities
exports.createModalities = async (req, res) => {
  try {
    const { modalitiesCode, modalitiesName, modalitiestype, isActive } =
      req.body;

    // Check for duplicates (if needed)
    const existingModalities = await Modalities.findOne({
      $or: [{ modalitiesName }, { modalitiesCode }],
    });
    if (existingModalities) {
      return res
        .status(400)
        .json({ message: "Modalities with this code or name already exists" });
    }
    // Create and save the new existingModalities
    const modalities = new Modalities({
      modalitiesCode,
      modalitiesName,
      modalitiestype,
      isActive,
    });
    await modalities.save();

    res.status(200).json({
      message: "Modalities created successfully",
      data: modalities._id,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all modalities
exports.getAllModalities = async (req, res) => {
  try {
    const modalities = await Modalities.find();

    if (!modalities) {
      return res.status(400).json({ message: "Modalities is not find" });
    }
    res.status(200).json(modalities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single modalities by name
exports.getModalitiesByName = async (req, res) => {
  try {
    const modalities = await Modalities.findOne({
      modalitiesName: req.body.modalitiesName,
    });

    if (!modalities) {
      return res.status(400).json({ message: "Modalities not found" });
    }

    res.status(200).json(modalities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a modalities
exports.updateModalities = async (req, res) => {
  try {
    const { _id, modalitiesCode, modalitiesName, modalitiestype, isActive } =
      req.body;

    const modalities = await Modalities.findByIdAndUpdate(
      _id,
      { $set: { modalitiesCode, modalitiesName, modalitiestype, isActive } },
      { new: true, runValidators: true },
    );

    if (!modalities) {
      return res.status(400).json({ message: "Modalities not found" });
    }

    res
      .status(200)
      .json({ message: "Modalities updated successfully", data: modalities });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a Modalities
exports.deleteModalities = async (req, res) => {
  try {
    const { _id } = req.body;

    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const modalities = await Modalities.findByIdAndDelete(_id);

    if (!modalities) {
      return res.status(400).json({ message: "Modalities not found" });
    }

    res.status(200).json({ message: "Modalities deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
