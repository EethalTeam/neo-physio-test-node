const mongoose = require("mongoose");
const Machine = require("../../model/masterModels/Machinery");

//Create Machinery

exports.createMachine = async (req, res) => {
  try {
    const {
      machineName,
      machineCategoryID,
      machineDescription,
      Manufacturer,
      machineModel,
      TotalStockCount,
      AvailableToAssign,
      isActive,
      machineNote,
      modalityId,
    } = req.body;

    const existingMachine = await Machine.findOne({
      $or: [{ modalityId }],
    });
    if (existingMachine) {
      return res
        .status(400)
        .json({ message: "Machine with this Id already exists" });
    }

    const lastMachine = await Machine.findOne(
      {},
      {},
      { sort: { createdAt: -1 } },
    );
    let nextMachineNumber = 1;

    if (lastMachine && lastMachine.machineCode) {
      const lastNumber = parseInt(
        lastMachine.machineCode.replace("MACHINE", ""),
      );
      nextMachineNumber = isNaN(lastNumber) ? 1 : lastNumber + 1;
    }

    const machineCode = `MACHINE${String(nextMachineNumber).padStart(3, "0")}`;

    const Machines = new Machine({
      machineCode,
      machineName,
      machineCategoryID,
      machineDescription,
      Manufacturer,
      machineModel,
      TotalStockCount,
      AvailableToAssign,
      isActive,
      machineNote,
      modalityId,
    });
    await Machines.save();
    res
      .status(200)
      .json({ message: "Machinery create successfully", data: Machines._id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//get all Machine

exports.getAllMachine = async (req, res) => {
  try {
    const Machines = await Machine.find().populate(
      "modalityId",
      "modalitiesName modalitiestype",
    );

    res.status(200).json(Machines);
    if (!Machines) {
      return res.status(400).json({ message: "Machine is not find" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single Machine  by Name
exports.getMachineByName = async (req, res) => {
  try {
    const Machines = await Machine.findOne({
      machineName: req.body.machineName,
    });

    if (!Machines) {
      return res.status(400).json({ message: "Machine not found" });
    }

    res.status(200).json(Machines);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//update Machine
exports.updateMachine = async (req, res) => {
  try {
    const {
      _id,
      machineCode,
      machineName,
      machineCategoryID,
      machineDescription,
      Manufacturer,
      machineModel,
      TotalStockCount,
      StockInMaintanance,
      AvailableToAssign,
      isActive,
      machineNote,
      Assignedto,
    } = req.body;

    const Machines = await Machine.findByIdAndUpdate(
      _id,
      {
        $set: {
          machineCode,
          machineName,
          machineCategoryID,
          machineDescription,
          Manufacturer,
          machineModel,
          TotalStockCount,
          isActive,
          StockInMaintanance,
          AvailableToAssign,
          machineNote,
          Assignedto,
        },
      },
      { new: true, runValidators: true },
    );

    if (!Machines) {
      return res.status(400).json({ message: "Machine not found" });
    }

    res.status(200).json({
      message: "Machine updated successfully",
      data: Machines,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.assignMachine = async (req, res) => {
  try {
    const { _id, Assignedto, AvailableToAssign } = req.body;

    const machine = await Machine.findByIdAndUpdate(
      _id,
      {
        $set: {
          Assignedto,
          AvailableToAssign,
        },
      },
      { new: true },
    );

    if (!machine) {
      return res.status(404).json({ message: "Machine not found" });
    }

    res.status(200).json(machine);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete a Machine
exports.deleteMachine = async (req, res) => {
  try {
    const { _id } = req.body;

    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const Machines = await Machine.findByIdAndDelete(_id);

    if (!Machines) {
      return res.status(400).json({ message: "Machine not found" });
    }

    res.status(200).json({ message: "Machine deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
