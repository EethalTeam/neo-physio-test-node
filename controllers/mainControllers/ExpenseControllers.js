const mongoose = require("mongoose");
const Expense = require("../../model/masterModels/Expense");

// Create Expense
exports.createExpense = async (req, res) => {
  try {
    const {
      ExpenseTypeID,
      ExpenseCategoryId,
      expenseDate,
      expenseAmount,
      PhysioId,
      physioDescription,
      officeExpDes,
      ReferenceId,
      PatientId,
      referenceDes,
      MachineiId,
      machineDes,
      otherDescription,
    } = req.body;

    const expense = new Expense({
      ExpenseTypeID,
      ExpenseCategoryId,
      expenseDate,
      expenseAmount,
      PhysioId: PhysioId || null,
      physioDescription: physioDescription || "",
      officeExpDes: officeExpDes || "",
      ReferenceId: ReferenceId || null,
      PatientId: PatientId || null,
      referenceDes: referenceDes || "",
      MachineiId: MachineiId || null,
      machineDes: machineDes || "",
      otherDescription: otherDescription || "",
    });

    await expense.save();

    const savedExpense = await Expense.findById(expense._id)
      .populate("ExpenseTypeID", "ExpenseTypeName")
      .populate("ExpenseCategoryId", "ExpenseCategoryName")
      .populate("PhysioId", "physioName")
      .populate("ReferenceId", "sourceName")
      .populate("PatientId", "patientName")
      .populate("MachineiId", "machineName");

    return res.status(201).json({
      message: "Expense created successfully",
      data: savedExpense,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Get All Expense
exports.getAllExpense = async (req, res) => {
  try {
    const expenses = await Expense.find()
      .populate("ExpenseTypeID", "ExpenseTypeName")
      .populate("ExpenseCategoryId", "ExpenseCategoryName")
      .populate("PhysioId", "physioName")
      .populate("ReferenceId", "sourceName")
      .populate("PatientId", "patientName")
      .populate("MachineiId", "machineName")
      .sort({ expenseDate: -1, createdAt: -1 });

    return res.status(200).json({
      message: "Expenses fetched successfully",
      data: expenses,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Get Single Expense
exports.getSingleExpense = async (req, res) => {
  try {
    const { _id } = req.body;

    if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Valid expense id is required" });
    }

    const expense = await Expense.findById(_id)
      .populate("ExpenseTypeID", "ExpenseTypeName")
      .populate("ExpenseCategoryId", "ExpenseCategoryName")
      .populate("PhysioId", "physioName")
      .populate("ReferenceId", "sourceName")
      .populate("PatientId", "patientName")
      .populate("MachineiId", "machineName");

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    return res.status(200).json({
      message: "Expense fetched successfully",
      data: expense,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Update Expense
exports.updateExpense = async (req, res) => {
  try {
    const {
      _id,
      ExpenseTypeID,
      ExpenseCategoryId,
      expenseDate,
      expenseAmount,
      PhysioId,
      physioDescription,
      officeExpDes,
      ReferenceId,
      PatientId,
      referenceDes,
      MachineiId,
      machineDes,
      otherDescription,
    } = req.body;

    if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Valid expense id is required" });
    }

    const expense = await Expense.findByIdAndUpdate(
      _id,
      {
        $set: {
          ExpenseTypeID,
          ExpenseCategoryId,
          expenseDate,
          expenseAmount,
          PhysioId: PhysioId || null,
          physioDescription: physioDescription || "",
          officeExpDes: officeExpDes || "",
          ReferenceId: ReferenceId || null,
          PatientId: PatientId || null,
          referenceDes: referenceDes || "",
          MachineiId: MachineiId || null,
          machineDes: machineDes || "",
          otherDescription: otherDescription || "",
        },
      },
      { new: true, runValidators: true },
    )
      .populate("ExpenseTypeID", "ExpenseTypeName")
      .populate("ExpenseCategoryId", "ExpenseCategoryName")
      .populate("PhysioId", "physioName")
      .populate("ReferenceId", "sourceName")
      .populate("PatientId", "patientName")
      .populate("MachineiId", "machineName");

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    return res.status(200).json({
      message: "Expense updated successfully",
      data: expense,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Delete Expense
exports.deleteExpense = async (req, res) => {
  try {
    const { _id } = req.body;

    if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Valid expense id is required" });
    }

    const expense = await Expense.findByIdAndDelete(_id);

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    return res.status(200).json({
      message: "Expense deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
