const Physio = require("../../model/masterModels/Physio");
const mongoose = require("mongoose");
const LeaveModel = require("../../model/masterModels/Leave");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// --- MULTER CONFIGURATION ---
const uploadDir = "physioPic";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(null, `physio-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mime = allowedTypes.test(file.mimetype);
  if (ext && mime) return cb(null, true);
  cb(new Error("Only .png, .jpg and .jpeg formats are allowed!"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("physioPic");

// --- MIDDLEWARE WRAPPER ---
exports.physioUploadMiddleware = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        message:
          err.code === "LIMIT_FILE_SIZE"
            ? "File too large (Max 5MB)"
            : err.message,
      });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// --- CREATE PHYSIO ---
exports.createPhysio = async (req, res) => {
  try {
    const data = req.body;
    const physioPic = req.file ? req.file.path : "";

    // Sequential Code Logic
    const lastPhysio = await Physio.findOne(
      {},
      {},
      { sort: { createdAt: -1 } },
    );
    let nextNum = 1;
    if (lastPhysio?.physioCode) {
      const lastNum = parseInt(lastPhysio.physioCode.replace("PHYSIO", ""));
      nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
    }
    const physioCode = `PHYSIO${String(nextNum).padStart(3, "0")}`;

    const newPhysio = new Physio({ ...data, physioCode, physioPic });
    await newPhysio.save();
    res.status(201).json(newPhysio);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- UPDATE PHYSIO ---
exports.updatePhysio = async (req, res) => {
  try {
    const { _id, ...updateData } = req.body;

    if (req.file) {
      // Delete old file if exists
      const oldRecord = await Physio.findById(_id);
      if (oldRecord?.physioPic && fs.existsSync(oldRecord.physioPic)) {
        fs.unlinkSync(oldRecord.physioPic);
      }
      updateData.physioPic = req.file.path;
    }

    const updated = await Physio.findByIdAndUpdate(_id, updateData, {
      new: true,
    });
    res.status(200).json(updated);
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

    const filter = {
      roleId: {
        $nin: [
          new mongoose.Types.ObjectId("6926c87fcddb76460d277682"),
          // new mongoose.Types.ObjectId("6926ca2ccddb76460d277717"),
          // new mongoose.Types.ObjectId("6926ca19cddb76460d277710"),
          // new mongoose.Types.ObjectId("6926c982cddb76460d2776ca"),
        ],
      },
    };

    if (type === undefined) {
      filter.isActive = true;
    }

    let physios = await Physio.find(filter)
      .populate("physioGenderId")
      .populate("roleId", "RoleName")
      // .skip(skip)
      // .limit(limit)
      .sort({ createdAt: -1 });

    // physios = physios.map((p) => {
    //   if (p.physioPic) {
    //     const filePath = path.join(__dirname, "../physioPic", p.physioPic);
    //     if (!fs.existsSync(filePath)) {
    //       p.physioPic = null;
    //     }
    //   }
    //   return p;
    // });
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
    console.log(physio, "physio");
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
