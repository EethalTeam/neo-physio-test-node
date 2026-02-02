const Physio = require("../../model/masterModels/Physio");
const mongoose = require("mongoose");
const LeaveModel = require("../../model/masterModels/Leave");
exports.createPhysio = async (req, res) => {
  try {
    const {
      physioName,
      EmpCode,
      // physioAge,
      physioDob,
      physioGenderId,
      physioContactNo,
      physioAltno,
      physiorelationAltno,
      physiorelationAltno2,
      physioAltno2,
      physioSpcl,
      physioQulifi,
      physioExp,
      physioPAN,
      physioAadhar,
      physioSalary,
      physioProbation,
      physioINCRDate,
      physioPetrolAlw,
      physioVehicleMTC,
      physioIncentive,
      isActive,
      physioNote,
      physioDescription,
      password,
      roleId,
    } = req.body;

    const lastPhysio = await Physio.findOne(
      {},
      {},
      { sort: { createdAt: -1 } },
    );
    let nextPhysioNumber = 1;

    if (lastPhysio && lastPhysio.physioCode) {
      const lastNumber = parseInt(lastPhysio.physioCode.replace("PHYSIO", ""));
      nextPhysioNumber = isNaN(lastNumber) ? 1 : lastNumber + 1;
    }

    const physioCode = `PHYSIO${String(nextPhysioNumber).padStart(3, "0")}`;

    const newPhysio = new Physio({
      physioCode,
      // physioAge,
      physioDob,
      physioName,
      EmpCode,
      physioGenderId,
      physioContactNo,
      physioAltno,
      physioAltno2,
      physioSpcl,
      physioQulifi,
      physioExp,
      physioPAN,
      physiorelationAltno,
      physiorelationAltno2,
      physioAadhar,
      physioSalary,
      physioProbation,
      physioINCRDate,
      physioPetrolAlw,
      physioVehicleMTC,
      physioIncentive,
      isActive,
      physioNote,
      physioDescription,
      password,
      roleId,
    });

    const savedPhysio = await newPhysio.save();
    res.status(201).json(savedPhysio);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Physio code already exists." });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};
exports.markLeave = async (req, res) => {
  try {
    const { physioId, LeaveDate, LeaveMode } = req.body;

    if (!physioId || !LeaveDate || !LeaveMode) {
      return res.status(400).json({
        message: "physioId, date, and leaveMode are required",
      });
    }
    const existingLeave = await LeaveModel.findOne({
      physioId: req.body.physioId,
      LeaveDate: LeaveDate,
    });
    if (existingLeave) {
      return res.status(400).json({
        message: "Already leave exists for this physio with this date ",
      });
    }

    const newLeave = new LeaveModel({
      physioId,
      LeaveDate,
      LeaveMode,
    });
    console.log(newLeave, "newLeave");

    const savedLeave = await newLeave.save();
    console.log(savedLeave, "savedLeave");
    const populateleave = await LeaveModel.findById(savedLeave._id).populate(
      "physioId",
      "physioName",
    );
    console.log(populateleave, "populateleave");
    res.status(201).json({
      success: true,
      message: "Leave marked successfully",
      data: populateleave,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Leave entry already exists." });
    }

    res.status(500).json({ message: error.message });
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
      .populate("physioId", "physioName") // populate only physioName
      .sort({ LeaveDate: -1 });

    res.status(200).json({
      totalLeaves: Leaves.length,
      Leaves,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllPhysios = async (req, res) => {
  try {
    // const page = parseInt(req.body.page) || 1;
    // const limit = parseInt(req.body.limit) || 10;
    // const skip = (page - 1) * limit;
    const { type } = req.body;
    const filter = {roleId: new mongoose.Types.ObjectId("6926ca2ccddb76460d277717")};
    if (type === undefined) {
      filter.isActive = true;
    }
    console.log(filter,"filter")
    const physios = await Physio.find(filter)
      .populate("physioGenderId")
      .populate("roleId", "RoleName")
      // .skip(skip)
      // .limit(limit)
      .sort({ createdAt: -1 });

    const totalPhysios = await Physio.countDocuments({ isActive: true });

    res.status(200).json({
      totalPhysios,
      // totalPages: Math.ceil(totalPhysios / limit),
      // currentPage: page,
      physios,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPhysioById = async (req, res) => {
  try {
    const { _id } = req.body;
    if (!_id) {
      return res
        .status(400)
        .json({ message: "Physio ID is required in the body." });
    }

    const physio = await Physio.findById(_id).populate("physioGenderId");

    if (!physio) {
      return res.status(404).json({ message: "Physio not found" });
    }

    res.status(200).json(physio);
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid Physio ID" });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.updatePhysio = async (req, res) => {
  try {
    const { _id, ...updateData } = req.body;

    if (!_id) {
      return res
        .status(400)
        .json({ message: "Physio ID is required in the body for updates." });
    }

    const updatedPhysio = await Physio.findByIdAndUpdate(
      _id,
      updateData,

      { new: true, runValidators: true },
    );

    if (!updatedPhysio) {
      return res.status(404).json({ message: "Physio not found" });
    }

    res.status(200).json(updatedPhysio);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Physio code already exists." });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.deletePhysio = async (req, res) => {
  try {
    const { _id } = req.body;
    if (!_id) {
      return res
        .status(400)
        .json({ message: "Physio ID is required in the body." });
    }
    const physio = await Physio.findByIdAndDelete(_id);
    if (!physio) {
      return res.status(400).json({ message: "Physio not found" });
    }
    res.status(200).json({ message: "Physio deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Soft delete
//     const softDeletedPhysio = await Physio.findByIdAndUpdate(
//       _id,
//       { isActive: false },
//       { new: true }
//     );

//     if (!softDeletedPhysio) {
//       return res.status(404).json({ message: "Physio not found" });
//     }

//     res.status(200).json({ message: "Physio deactivated successfully" });
//   } catch (error) {
//     if (error.name === "CastError") {
//       return res.status(400).json({ message: "Invalid Physio ID" });
//     }
//     res.status(500).json({ message: error.message });
//   }
// };

// LOGIN Physio
exports.loginPhysio = async (req, res) => {
  try {
    const { physioCode, password } = req.body;
    // 1. Reject if request is from mobile device
    // const userAgent = req.headers["user-agent"] || "";
    // const isMobile = /mobile|android|iphone|ipad|phone/i.test(userAgent);
    // if (isMobile) {
    //   return res.status(403).json({ message: "Login from mobile devices is not allowed" });
    // }

    // 2. Find employee by email
    const physio = await Physio.findOne({ physioCode: physioCode }).populate(
      "roleId",
      "RoleName",
    );
    if (!physio) {
      return res.status(404).json({ message: "Invalid Employee Code" });
    }

    // 4. Compare plain password (since not hashing yet)
    if (physio.password !== password) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // 5. Mark employee as logged in
    // physio.isCurrentlyLoggedIn = true;
    // await physio.save();

    // 6. Success
    res.status(200).json({
      message: "Login successful",
      physio: {
        _id: physio._id,
        physioName: physio.physioName,
        physioCode: physio.physioCode,
        role: physio.roleId.RoleName,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

exports.logoutPhysio = async (req, res) => {
  try {
    const { physioCode } = req.body; // or get from token/session if you’re using auth

    // 1. Find employee
    const physio = await Physio.findOne({ email: email });
    if (!physio) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // 2. Check if already logged out
    if (!physio.isCurrentlyLoggedIn) {
      return res.status(400).json({ message: "physio is already logged out" });
    }

    // 3. Update login status
    physio.isCurrentlyLoggedIn = false;
    await physio.save();

    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Logout failed", error: error.message });
  }
};

exports.logoutUser = async (_id) => {
  try {
    // Update lastActive or any other logout tracking if needed
    await Physio.findByIdAndUpdate(_id, { isCurrentlyLoggedIn: false });
  } catch (err) {
    console.error("❌ Error logging out user:", err.message);
  }
};

exports.checkLogin = async (req, res, next) => {
  try {
    const userId = req.headers["x-user-id"]; // userId passed from frontend
    if (!userId) {
      return res.status(401).json({ message: "User ID missing" });
    }

    const user = await Physio.findById(userId);

    if (!user || !user.isCurrentlyLoggedIn) {
      return res.status(401).json({ message: "User not logged in" });
    }

    // ✅ User is valid and logged in
    req.user = user;
    next();
  } catch (err) {
    console.error("checkLogin error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
