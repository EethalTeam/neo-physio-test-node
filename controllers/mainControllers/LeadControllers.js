const Lead = require("../../model/masterModels/Leads");
const Patient = require("../../model/masterModels/Patient");
const Consultation = require("../../model/masterModels/Consultation");
const LeadStatus = require("../../model/masterModels/Leadstatus");
const Employee = require("../../model/masterModels/Physio");
const RoleBased = require("../../model/masterModels/RBAC");
const Notification = require("../../model/masterModels/Notification");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Link = require("../../model/masterModels/Link");
const multer = require("multer");
const Role = require("../../model/masterModels/RBAC");

// --- MULTER CONFIGURATION FOR LEAD DOCUMENTS ---
const uploadDir = "uploads/leads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(
      null,
      `lead-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(
        file.originalname,
      )}`,
    );
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    return cb(null, true);
  }

  cb(
    new Error(
      "Only jpg, jpeg, png, pdf, doc, docx, xls, xlsx files are allowed!",
    ),
  );
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 },
}).array("leadDocuments", 10);

// --- MIDDLEWARE WRAPPER ---
exports.leadUploadMiddleware = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        message:
          err.code === "LIMIT_FILE_SIZE"
            ? "File too large (Max 15MB)"
            : err.message,
      });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

exports.createLead = async (req, res) => {
  try {
    console.log("🚀 Step 1: createLead API called");

    const {
      leadName,
      leadAge,
      leadGenderId,
      physioCategoryId,
      leadContactNo,
      leadSourceId,
      leadMedicalHistory,
      leadAddress,
      isQualified,
      ReferenceId,
      leadSourceName,
      sourceName,
      LeadStatusId,
      leadStatusName,
      cbDate,
      isExternal,
      sixdigit,
    } = req.body;

    console.log("📩 Step 2: Request body received", {
      leadName,
      leadContactNo,
      isExternal,
    });

    if (isExternal) {
      console.log("🌐 Step 3: External lead detected, validating key...");

      const validation = await Link.findOne({ key: sixdigit });

      if (!validation) {
        console.log("❌ Step 3.1: Invalid external key");
        return res.status(409).json({
          success: false,
          message: "Invalid key Found",
        });
      }

      if (validation.isExpired) {
        console.log("⛔ Step 3.2: External key expired");
        return res.status(409).json({
          success: false,
          message: "This link has been Expired",
        });
      }

      console.log("✅ Step 3.3: External key validated");
    }

    console.log("🔍 Step 4: Checking existing lead...");

    const existingLead = await Lead.findOne({ leadContactNo });

    if (existingLead) {
      console.log("⚠️ Step 4.1: Lead already exists");
      return res.status(409).json({
        success: false,
        message: "EXISTING_NUMBER",
      });
    }

    console.log("✅ Step 4.2: No duplicate lead found");

    let leadDocuments = [];

    if (req.files && req.files.length > 0) {
      console.log("📎 Step 5: Processing uploaded files");

      leadDocuments = req.files.map((file) => ({
        fileName: file.originalname,
        fileUrl: `/uploads/leads/${file.filename}`,
        fileType: file.mimetype,
      }));
    }

    console.log("🧾 Step 6: Generating lead code...");

    const lastLead = await Lead.findOne({}, {}, { sort: { createdAt: -1 } });
    let nextLeadNumber = 1;

    if (lastLead && lastLead.leadCode) {
      const lastNumber = parseInt(lastLead.leadCode.replace("LEAD", ""), 10);
      nextLeadNumber = isNaN(lastNumber) ? 1 : lastNumber + 1;
    }

    const leadCode = `LEAD${String(nextLeadNumber).padStart(3, "0")}`;

    console.log("🆔 Step 6.1: Generated Lead Code:", leadCode);

    let finalLeadSourceId = null;
    let finalLeadSourceName = "";

    console.log("📊 Step 7: Assigning lead source...");

    if (ReferenceId) {
      finalLeadSourceId = null;
      finalLeadSourceName = "Reference";
    } else if (isExternal) {
      finalLeadSourceId = "690d7691af1192eb5b523d63";
      finalLeadSourceName = "Online";
    } else {
      finalLeadSourceId = leadSourceId || null;
      finalLeadSourceName = leadSourceName || "";
    }

    const LeadData = {
      leadName,
      leadCode,
      leadAge,
      leadGenderId,
      physioCategoryId,
      leadContactNo,
      leadSourceId: finalLeadSourceId,
      leadMedicalHistory,
      leadAddress,
      isExternal: isExternal || false,
      isQualified: isQualified || false,
      leadDocuments,
      leadSourceName: finalLeadSourceName,
      sourceName: sourceName || "",
      LeadStatusId,
      leadStatusName,
      cbDate,
    };

    if (ReferenceId) {
      LeadData.ReferenceId = ReferenceId;
    }

    console.log("💾 Step 8: Saving lead to database...");

    const newLead = new Lead(LeadData);
    const savedLead = await newLead.save();

    console.log("✅ Step 8.1: Lead saved successfully", {
      id: savedLead._id,
      code: savedLead.leadCode,
    });

    // 🔔 NOTIFICATION
    if (isExternal) {
      console.log("🔔 Step 9: Creating notification for external lead...");

      const roles = await Role.find({
        RoleName: { $in: ["SuperAdmin", "Admin", "HOD"] },
      });
      if (!roles.length) {
        console.log("⚠️ No roles found");
      } else {
        // notification logic

        let notifications = [];

        for (const role of roles) {
          const employees = await Employee.find({ roleId: role._id });

          console.log(`👤 ${role.RoleName} → ${employees.length} employees`);

          for (const emp of employees) {
            notifications.push({
              title: "External Lead Received",
              message: `${leadName} (${leadContactNo}) submitted a lead via external link`,
              type: "LEAD",
              referenceId: savedLead._id,

              // ✅ THIS IS THE KEY FIELD
              toEmployeeId: emp._id,

              roleId: role._id,

              status: "unseen",

              meta: {
                leadCode: savedLead.leadCode,
                source: "External",
                role: role.RoleName,
              },

              createdAt: new Date(),
            });
          }
        }

        console.log("📨 Notifications ready:", notifications.length);

        await Notification.insertMany(notifications);

        console.log("✅ Notifications inserted successfully");
      }
    }
    // expire link
    if (isExternal) {
      console.log("⏳ Step 10: Expiring external link...");

      const validation = await Link.findOne({ key: sixdigit });
      if (validation && !validation.isExpired) {
        validation.isExpired = true;
        await validation.save();
      }

      console.log("✔️ Step 10.1: Link expired");
    }

    console.log("🎉 Step 11: API completed successfully");

    return res.status(201).json(savedLead);
  } catch (error) {
    console.error("❌ createLead error:", error);

    if (error.code === 11000) {
      console.log("⚠️ Duplicate lead code error");
      return res.status(400).json({
        success: false,
        message: "Lead code already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
exports.updateLead = async (req, res) => {
  try {
    const {
      leadId,
      leadName,
      leadCode,
      leadAge,
      leadGenderId,
      physioCategoryId,
      leadContactNo,
      leadSourceId,
      leadMedicalHistory,
      leadAddress,
      isQualified,
      ReferenceId,
      sourceName,
      leadSourceName,
      LeadStatusId,
      leadStatusName,
      cbDate,
      removedDocuments,
    } = req.body;

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    let existingDocuments = lead.leadDocuments || [];

    if (removedDocuments) {
      let removedDocsArray = [];

      try {
        removedDocsArray =
          typeof removedDocuments === "string"
            ? JSON.parse(removedDocuments)
            : removedDocuments;
      } catch (e) {
        removedDocsArray = [];
      }

      existingDocuments = existingDocuments.filter((doc) => {
        const shouldRemove = removedDocsArray.includes(doc.fileUrl);

        if (shouldRemove) {
          const fullPath = path.join(__dirname, "../../", doc.fileUrl);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        }

        return !shouldRemove;
      });
    }

    if (req.files && req.files.length > 0) {
      const newDocuments = req.files.map((file) => ({
        fileName: file.originalname,
        fileUrl: `/${file.path.replace(/\\/g, "/")}`,
        fileType: file.mimetype,
      }));

      existingDocuments.push(...newDocuments);
    }

    let LeadData = {
      leadName,
      leadCode,
      leadAge,
      leadGenderId,
      physioCategoryId,
      leadContactNo,
      leadMedicalHistory,
      leadAddress,
      isQualified: isQualified || false,
      leadDocuments: existingDocuments,
      leadSourceName,
      sourceName,
      LeadStatusId,
      leadStatusName,
      cbDate,
    };

    if (leadSourceName === "Reference") {
      LeadData.leadSourceId = null;
      LeadData.ReferenceId = ReferenceId || null;
    } else {
      LeadData.leadSourceId = leadSourceId || null;
      LeadData.ReferenceId = null;
      LeadData.sourceName = "";
    }

    const updatedLead = await Lead.findByIdAndUpdate(
      leadId,
      { $set: LeadData },
      { new: true, runValidators: true },
    );

    return res.status(200).json(updatedLead);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getAllLeads = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 500;
    const skip = (page - 1) * limit;

    const leads = await Lead.find()
      .populate(
        "leadGenderId leadSourceId physioCategoryId ReferenceId LeadStatusId",
      )
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const totalLeads = await Lead.countDocuments();

    res.status(200).json({
      totalLeads,
      totalPages: Math.ceil(totalLeads / limit),
      currentPage: page,
      leads,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id).populate(
      "leadGenderId leadSourceId physioCategoryId ReferenceId LeadStatusId",
    );

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    res.status(200).json(lead);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.QualifyLead = async (req, res) => {
  try {
    const {
      _id,
      leadName,
      leadAge,
      leadGenderId,
      leadContactNo,
      leadSourceId,
      leadMedicalHistory,
      leadAddress,
      ReferenceId,
      ConsultationDate,
      fromEmployeeId,
    } = req.body;

    const lastConsultant = await Consultation.findOne(
      {},
      {},
      { sort: { createdAt: -1 } },
    );
    let nextPatientNumber = 1;

    if (lastConsultant && lastConsultant.patientCode) {
      const lastNumber = parseInt(
        lastConsultant.patientCode.replace("CON", ""),
      );
      nextPatientNumber = isNaN(lastNumber) ? 1 : lastNumber + 1;
    }

    const patientCode = `CON${String(nextPatientNumber).padStart(6, "0")}`;
    const fullLead = await Lead.findById(_id);

    if (!fullLead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const consult = new Consultation({
      patientName: fullLead.leadName,
      patientCode: patientCode,
      isActive: true,
      consultationDate: ConsultationDate,
      patientAge: fullLead.leadAge,
      otherMedCon: fullLead.leadMedicalHistory,
      patientGenderId: fullLead.leadGenderId,
      patientNumber: fullLead.leadContactNo,
      patientAddress: fullLead.leadAddress,
      leadId: fullLead._id,
      consultationDocuments: fullLead.leadDocuments || [],
    });

    if (fullLead.ReferenceId) {
      consult.ReferenceId = new mongoose.Types.ObjectId(fullLead.ReferenceId);
    }

    await consult.save();

    if (consult) {
      // --- NOTIFICATION LOGIC ---
      try {
        const roleId = await RoleBased.findOne({ RoleName: "HOD" });
        if (roleId) {
          const hodEmployees = await Employee.find({ roleId: roleId._id });
          if (hodEmployees.length > 0) {
            const io = req.app.get("socketio");
            const notificationPromises = hodEmployees.map(async (hod) => {
              const newNotification = new Notification({
                fromEmployeeId: fromEmployeeId,
                toEmployeeId: hod._id,
                message: `New Consultation created for ${leadName}. Scheduled Date: ${new Date(
                  ConsultationDate,
                ).toLocaleDateString()}`,
                type: "Consultation-Reminder",
                status: "unseen",
                meta: {
                  ConsultationId: consult._id,
                  PatientId: null,
                  LeadId: _id,
                },
              });
              await newNotification.save();
              if (io) {
                io.to(hod._id.toString()).emit(
                  "receiveNotification",
                  newNotification,
                );
              }
            });
            await Promise.all(notificationPromises);
          }
        }
      } catch (notifyError) {
        console.error("Notification Error:", notifyError.message);
      }

      // --- LEAD STATUS UPDATE ---
      const Leadstatus = await LeadStatus.findOne({
        leadStatusName: "Qualified",
      });
      if (Leadstatus) {
        const lead = await Lead.findByIdAndUpdate(
          _id,
          {
            $set: { LeadStatusId: new mongoose.Types.ObjectId(Leadstatus._id) },
          },
          { new: true, runValidators: true },
        );
        if (!lead) {
          return res.status(404).json({ message: "Lead not able to update" });
        }
      } else {
        // 🔥 Added RETURN here to stop execution
        return res
          .status(500)
          .json({ message: 'Lead status "Qualified" not found' });
      }

      // Final success response
      return res.status(200).json({
        message: "Lead qualified and Patient created successfully",
        data: consult._id,
      });
    } else {
      // 🔥 Added RETURN here
      return res.status(500).json({ message: "Lead qualify failed" });
    }
  } catch (err) {
    // 🔥 Added RETURN here
    return res.status(500).json({ message: err.message });
  }
};

exports.deleteLead = async (req, res) => {
  try {
    const { _id } = req.body;

    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const lead = await Lead.findByIdAndDelete(_id);

    if (!lead) {
      return res.status(44).json({ message: "Lead not found" });
    }

    // if (lead.leadDocuments && lead.leadDocuments.length > 0) {
    //     lead.leadDocuments.forEach(doc => {
    //         // 'doc.fileUrl' is like '/uploads/leads/filename.pdf'
    //         const filePath = path.join(__dirname, '..', doc.fileUrl);

    //         fs.unlink(filePath, (err) => {
    //             if (err) {
    //                 console.error(`Failed to delete file: ${filePath}`, err);
    //             }
    //         });
    //     });
    // }

    // await lead.deleteOne();

    res.status(200).json({ message: "Lead deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
