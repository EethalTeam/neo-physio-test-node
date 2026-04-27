const mongoose = require("mongoose");
const { jsPDF } = require("jspdf");
const { autoTable } = require("jspdf-autotable");
const Session = require("../../model/masterModels/Session");
const Leave = require("../../model/masterModels/Leave");
const Physio = require("../../model/masterModels/Physio");
const Role = require("../../model/masterModels/RBAC");
const ReviewModel = require("../../model/masterModels/Review");
const Lead = require("../../model/masterModels/Leads");
const ConsultationModel = require("../../model/masterModels/Consultation");
const ExcelJS = require("exceljs");
const PatientModel = require("../../model/masterModels/Patient");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const fs = require("fs");
const path = require("path");

// LOAD LOGO
const logoPath = path.join(__dirname, "../../assets/images/logo_png.png");
const logoBase64 = fs.readFileSync(logoPath, "base64");
exports.downloadPhysioWiseReportXLSX = async (req, res) => {
  try {
    const { month, year, physioId, referenceId } = req.body;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // ---------------- DATA ----------------
    const roleDocs = await Role.find({
      RoleName: { $in: ["Physio", "HOD"] },
    });

    const roleIds = roleDocs.map((r) => r._id);

    const physios = await Physio.find({
      ...(physioId && physioId !== "all" && { _id: physioId }),
      roleId: { $in: roleIds },
    });

    // 🔥 FIX: reference filter support added
    const sessionFilter = {
      sessionDate: { $gte: startDate, $lte: endDate },
      ...(physioId && physioId !== "all" && { physioId }),
    };

    const sessions = await Session.find(sessionFilter).populate(
      "physioId patientId sessionStatusId",
    );

    const leaves = await Leave.find({
      LeaveDate: { $gte: startDate, $lte: endDate },
      ...(physioId && physioId !== "all" && { physioId }),
    }).populate("physioId");

    // ---------------- MAP ----------------
    const map = {};
    const patientMap = {};

    physios.forEach((p) => {
      const id = String(p._id);

      map[id] = {
        physioName: p.physioName || "Unknown",
        totalSessions: 0,
        completedSessions: 0,
        cancelledSessions: 0,
        assignedPatients: new Set(),
        leaveDays: 0,
        leaveEntries: [],
      };

      patientMap[id] = {};
    });

    // ---------------- SESSIONS ----------------
    sessions.forEach((s) => {
      const id = String(s.physioId?._id);
      if (!map[id]) return;

      map[id].totalSessions++;

      const status = (s.sessionStatusId?.sessionStatusName || "").toLowerCase();

      if (status.includes("complete")) map[id].completedSessions++;
      else if (status.includes("cancel")) map[id].cancelledSessions++;

      const patient = s.patientId;
      const patientId = String(patient?._id || patient);

      map[id].assignedPatients.add(patientId);

      if (patient && patient._id) {
        patientMap[id][patientId] = {
          patientCode: patient.patientCode || "N/A",
          patientName: patient.patientName || "N/A",
          patientNumber: patient.patientNumber || "N/A",
          condition: patient.otherMedCon || "N/A",
        };
      }
    });

    // ---------------- LEAVES ----------------
    leaves.forEach((l) => {
      const id = String(l.physioId?._id);
      if (!map[id]) return;

      map[id].leaveDays += (l.LeaveMode || "").toLowerCase().includes("half")
        ? 0.5
        : 1;

      map[id].leaveEntries.push(l);
    });

    // ---------------- WORKBOOK ----------------
    const workbook = new ExcelJS.Workbook();

    // ================= SUMMARY SHEET =================
    const summarySheet = workbook.addWorksheet("Physio Summary");

    summarySheet.columns = [
      { header: "Physio Name", key: "name", width: 25 },
      { header: "Total Sessions", key: "total", width: 15 },
      { header: "Completed", key: "completed", width: 15 },
      { header: "Cancelled", key: "cancelled", width: 15 },
      { header: "Patients", key: "patients", width: 15 },
      { header: "Leave Days", key: "leaves", width: 15 },
    ];

    Object.entries(map).forEach(([id, p]) => {
      summarySheet.addRow({
        name: p.physioName,
        total: p.totalSessions,
        completed: p.completedSessions,
        cancelled: p.cancelledSessions,
        patients: p.assignedPatients.size,
        leaves: p.leaveDays,
      });
    });

    // ================= PATIENT SHEET =================
    const patientSheet = workbook.addWorksheet("Assigned Patients");

    patientSheet.columns = [
      { header: "Physio", key: "physio", width: 25 },
      { header: "Patient Code", key: "code", width: 20 },
      { header: "Patient Name", key: "name", width: 25 },
      { header: "Mobile", key: "mobile", width: 20 },
      { header: "Condition", key: "condition", width: 30 },
    ];

    Object.keys(patientMap).forEach((physioId) => {
      const physioName =
        physios.find((p) => String(p._id) === physioId)?.physioName ||
        "Unknown";

      const patients = patientMap[physioId];

      if (Object.keys(patients).length === 0) {
        patientSheet.addRow({
          physio: physioName,
          code: "N/A",
          name: "No Patients",
          mobile: "",
          condition: "",
        });
      } else {
        Object.values(patients).forEach((p) => {
          patientSheet.addRow({
            physio: physioName,
            code: p.patientCode,
            name: p.patientName,
            mobile: p.patientNumber,
            condition: p.condition,
          });
        });
      }
    });

    // ================= LEAVE SHEET =================
    const leaveSheet = workbook.addWorksheet("Leave Details");

    leaveSheet.columns = [
      { header: "Physio", key: "physio", width: 25 },
      { header: "Date", key: "date", width: 20 },
      { header: "Mode", key: "mode", width: 15 },
      { header: "Paid Leave", key: "paid", width: 15 },
    ];

    Object.values(map).forEach((p) => {
      if (!p.leaveEntries.length) {
        leaveSheet.addRow({
          physio: p.physioName,
          date: "",
          mode: "No Leave",
          paid: "",
        });
      } else {
        p.leaveEntries.forEach((l) => {
          leaveSheet.addRow({
            physio: p.physioName,
            date: new Date(l.LeaveDate).toLocaleDateString("en-GB"),
            mode: l.LeaveMode || "N/A",
            paid: l.PaidLeave ? "Yes" : "No",
          });
        });
      }
    });

    // ---------------- RESPONSE ----------------
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=physio-wise-report.xlsx",
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Error generating XLSX report",
      error: err.message,
    });
  }
};
exports.downloadPhysioWiseReportPDF = async (req, res) => {
  try {
    const { month, year, physioId, referenceId } = req.body;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // ---------------- DATA ----------------
    const roleDocs = await Role.find({
      RoleName: { $in: ["Physio", "HOD"] },
    });

    const roleIds = roleDocs.map((r) => r._id);

    const physios = await Physio.find({
      ...(physioId && physioId !== "all" && { _id: physioId }),
      roleId: { $in: roleIds },
    });

    const sessions = await Session.find({
      sessionDate: { $gte: startDate, $lte: endDate },
      ...(physioId && physioId !== "all" && { physioId }),
    }).populate("physioId patientId sessionStatusId");

    const leaves = await Leave.find({
      LeaveDate: { $gte: startDate, $lte: endDate },
      ...(physioId && physioId !== "all" && { physioId }),
    }).populate("physioId");

    // ---------------- MAP ----------------
    const map = {};
    const patientMap = {};

    physios.forEach((p) => {
      const id = String(p._id);

      map[id] = {
        physioName: p.physioName || "Unknown",
        totalSessions: 0,
        completedSessions: 0,
        cancelledSessions: 0,
        assignedPatients: new Set(),
        leaveEntries: [],
        leaveDays: 0,
      };

      patientMap[id] = {};
    });

    // ---------------- SESSIONS ----------------
    sessions.forEach((s) => {
      const id = String(s.physioId?._id);
      if (!map[id]) return;

      map[id].totalSessions++;

      const status = (s.sessionStatusId?.sessionStatusName || "").toLowerCase();

      if (status.includes("complete")) map[id].completedSessions++;
      else if (status.includes("cancel")) map[id].cancelledSessions++;

      const patient = s.patientId;
      const patientId = String(patient?._id || patient);

      map[id].assignedPatients.add(patientId);

      if (patient && patient._id) {
        patientMap[id][patientId] = {
          patientCode: patient.patientCode || "N/A",
          patientName: patient.patientName || "N/A",
          patientNumber: patient.patientNumber || "N/A",
          condition: patient.otherMedCon || "N/A",
        };
      }
    });

    // ---------------- LEAVES ----------------
    leaves.forEach((l) => {
      const id = String(l.physioId?._id);
      if (!map[id]) return;

      map[id].leaveEntries.push(l);
      map[id].leaveDays += (l.LeaveMode || "").toLowerCase().includes("half")
        ? 0.5
        : 1;
    });

    // ---------------- PDF ----------------
    const doc = new jsPDF("l", "mm", "a4");

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const reportMonth = monthNames[month - 1];
    const generatedDate = new Date().toLocaleString("en-GB");
    doc.addImage(logoBase64, "PNG", 10, 5, 28, 28);
    doc.setFontSize(16);
    doc.text("NEO PHYSIO", 40, 15);

    doc.setFontSize(12);
    doc.text("Physiotherapy Performance Report", 40, 22);

    doc.setFontSize(10);
    doc.text(`Month: ${reportMonth}`, 10, 32);
    doc.text(`Year: ${year}`, 10, 38);
    doc.text(`Generated: ${generatedDate}`, 10, 44);

    doc.line(10, 48, 285, 48);

    let y = 55;

    Object.entries(map).forEach(([id, p], index) => {
      doc.setFontSize(12);
      doc.text(p.physioName, 10, y);
      y += 5;

      // ---------------- SUMMARY TABLE ----------------
      autoTable(doc, {
        startY: y,
        head: [
          [
            "S.No",
            "Physio",
            "Total",
            "Completed",
            "Cancelled",
            "Patients",
            "Leave Days",
          ],
        ],
        body: [
          [
            index + 1,
            p.physioName,
            p.totalSessions,
            p.completedSessions,
            p.cancelledSessions,
            p.assignedPatients.size,
            p.leaveDays,
          ],
        ],
      });

      y = doc.lastAutoTable.finalY + 6;

      // ---------------- PATIENT LIST ----------------
      doc.setFontSize(11);
      doc.text("Assigned Patients", 10, y);
      y += 4;

      const patientRows = Object.values(patientMap[id] || {}).map((p) => [
        p.patientCode,
        p.patientName,
        p.patientNumber,
        p.condition,
      ]);

      autoTable(doc, {
        startY: y,
        head: [["Code", "Name", "Mobile", "Condition"]],
        body: patientRows.length ? patientRows : [["No Patients", "", "", ""]],
      });

      y = doc.lastAutoTable.finalY + 6;

      // ---------------- LEAVE LIST (🔥 FIXED SECTION) ----------------
      doc.setFontSize(11);
      doc.text("Leave Details", 10, y);
      y += 4;

      const leaveRows = p.leaveEntries.length
        ? p.leaveEntries.map((l, i) => [
            i + 1,
            new Date(l.LeaveDate).toLocaleDateString("en-GB"),
            l.LeaveMode || "N/A",
            l.PaidLeave ? "Yes" : "No",
          ])
        : [["-", "No Leave", "-", "-"]];

      autoTable(doc, {
        startY: y,
        head: [["S.No", "Date", "Mode", "Paid"]],
        body: leaveRows,
      });

      y = doc.lastAutoTable.finalY + 10;

      if (y > 180) {
        doc.addPage();
        y = 20;
      }
    });

    const pdfBuffer = doc.output("arraybuffer");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=physio-wise-report.pdf",
    );

    return res.send(Buffer.from(pdfBuffer));
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Error generating report",
      error: err.message,
    });
  }
};

exports.downloadReportCSV = async (req, res) => {
  try {
    const { physioId, referenceId, month, year } = req.body;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const sessions = await Session.find({
      sessionDate: { $gte: startDate, $lte: endDate },
      ...(physioId && physioId !== "all" && { physioId }),
      ...(referenceId && referenceId !== "all" && { sourceId: referenceId }),
    }).populate("patientId sessionStatusId");

    // 🔥 FIXED: correct role filter using roleId
    const roleDocs = await Role.find({
      RoleName: { $in: ["Physio", "HOD"] },
    });

    const roleIds = roleDocs.map((r) => r._id);

    const physios = await Physio.find({
      ...(physioId && physioId !== "all" && { _id: physioId }),
      roleId: { $in: roleIds },
    });

    const leaves = await Leave.find({
      LeaveDate: { $gte: startDate, $lte: endDate },
      ...(physioId && physioId !== "all" && { physioId }),
    });

    // ---------------- STATS ----------------
    let totalSessions = sessions.length;
    let completedSessions = 0;
    let cancelledSessions = 0;
    let patients = new Set();

    sessions.forEach((s) => {
      const status = (s.sessionStatusId?.sessionStatusName || "").toLowerCase();

      if (status.includes("complete")) completedSessions++;
      else if (status.includes("cancel")) cancelledSessions++;

      if (s.patientId) patients.add(String(s.patientId));
    });

    const totalLeaveDays = leaves.reduce((acc, l) => {
      return (
        acc + ((l.LeaveMode || "").toLowerCase().includes("half") ? 0.5 : 1)
      );
    }, 0);

    const rows = [
      ["Metric", "Value"],
      ["Total Physio", physios.length],
      ["Total Sessions", totalSessions],
      ["Completed Sessions", completedSessions],
      ["Cancelled Sessions", cancelledSessions],
      ["Total Patients", patients.size],
      ["Total Leave Days", totalLeaveDays],
    ];

    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=report_${month}_${year}.csv`,
    );

    return res.send(csv);
  } catch (err) {
    return res.status(500).json({
      message: "CSV generation failed",
      error: err.message,
    });
  }
};
exports.downloadReportPDF = async (req, res) => {
  try {
    const { physioId, referenceId, month, year } = req.body;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const sessions = await Session.find({
      sessionDate: { $gte: startDate, $lte: endDate },
      ...(physioId && physioId !== "all" && { physioId }),
      ...(referenceId && referenceId !== "all" && { sourceId: referenceId }),
    }).populate("patientId sessionStatusId");

    // 🔥 ROLE FILTER FIX
    const roleDocs = await Role.find({
      RoleName: { $in: ["Physio", "HOD"] },
    });

    const roleIds = roleDocs.map((r) => r._id);

    const physios = await Physio.find({
      ...(physioId && physioId !== "all" && { _id: physioId }),
      roleId: { $in: roleIds },
    });

    const leaves = await Leave.find({
      LeaveDate: { $gte: startDate, $lte: endDate },
      ...(physioId && physioId !== "all" && { physioId }),
    });

    // ---------------- STATS ----------------
    let completed = 0;
    let cancelled = 0;
    let patients = new Set();

    sessions.forEach((s) => {
      const status = (s.sessionStatusId?.sessionStatusName || "").toLowerCase();

      if (status.includes("complete")) completed++;
      else if (status.includes("cancel")) cancelled++;

      if (s.patientId) patients.add(String(s.patientId));
    });

    const totalLeaveDays = leaves.reduce((acc, l) => {
      return (
        acc + ((l.LeaveMode || "").toLowerCase().includes("half") ? 0.5 : 1)
      );
    }, 0);

    const doc = new jsPDF();

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const reportMonth = monthNames[month - 1];

    // ================= LOGO =================
    doc.addImage(logoBase64, "PNG", 10, 8, 22, 22);

    // ================= TITLE SECTION =================
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("NEO PHYSIO REPORT", 105, 15, { align: "center" });

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Month: ${reportMonth} ${year}`, 105, 22, { align: "center" });

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, 105, 28, {
      align: "center",
    });

    // ================= LINE =================
    doc.setLineWidth(0.5);
    doc.line(10, 35, 200, 35);
    // ---------------- TABLE ----------------
    autoTable(doc, {
      startY: 40,
      head: [["Metric", "Value"]],
      body: [
        ["Total Physio", physios.length],
        ["Total Sessions", sessions.length],
        ["Completed Sessions", completed],
        ["Cancelled Sessions", cancelled],
        ["Total Patients", patients.size],
        ["Total Leave Days", totalLeaveDays],
      ],
      theme: "grid",
    });

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=report_${month}_${year}.pdf`,
    );

    return res.send(pdfBuffer);
  } catch (err) {
    return res.status(500).json({
      message: "PDF generation failed",
      error: err.message,
    });
  }
};

exports.downloadHodReportCSV = async (req, res) => {
  try {
    const { physioId, referenceId, month, year, role } = req.body;

    if (role !== "HOD") {
      return res.status(403).json({ message: "Access denied" });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // ---------------- DATA ----------------
    const sessions = await Session.find({
      sessionDate: { $gte: startDate, $lte: endDate },
    }).populate("patientId sessionStatusId");

    const reviews = await ReviewModel.find({
      reviewDate: { $gte: startDate, $lte: endDate },
    }).populate("reviewStatusId");
    console.log(reviews, "reviews");
    const consultations = await ConsultationModel.find({
      consultationDate: { $gte: startDate, $lte: endDate },
    });

    const leads = await Lead.find({
      createdAt: { $gte: startDate, $lte: endDate },
    });

    // ---------------- SESSION STATS ----------------
    let completedSessions = 0;
    let cancelledSessions = 0;
    let patients = new Set();

    sessions.forEach((s) => {
      const status = (s.sessionStatusId?.sessionStatusName || "").toLowerCase();

      if (status.includes("complete")) completedSessions++;
      else if (status.includes("cancel")) cancelledSessions++;

      if (s.patientId) patients.add(String(s.patientId));
    });

    // ---------------- REVIEW STATS ----------------
    const completedReviews = reviews.filter(
      (r) => (r.reviewStatusId?.reviewStatusName || "") === "Completed",
    ).length;

    const pendingReviews = reviews.length - completedReviews;

    // ---------------- CONSULTATION STATS ----------------
    const completedConsultations = consultations.filter(
      (c) => c.physioId && c.sessionStartDate,
    ).length;

    const pendingConsultations = consultations.filter(
      (c) => !c.physioId || !c.sessionStartDate,
    ).length;

    const convertedLeads = consultations.filter((c) => c.leadId).length;

    // ---------------- CSV ----------------
    const rows = [
      ["Metric", "Value"],
      ["Total Sessions", sessions.length],
      ["Completed Sessions", completedSessions],
      ["Cancelled Sessions", cancelledSessions],
      ["Total Patients", patients.size],

      ["Total Reviews", reviews.length],
      ["Completed Reviews", completedReviews],
      ["Pending Reviews", pendingReviews],

      ["Total Consultations", consultations.length],
      ["Completed Consultations", completedConsultations],
      ["Pending Consultations", pendingConsultations],

      ["Total Leads", leads.length],
      ["Converted Leads", convertedLeads],
    ];

    const csv = rows.map((r) => r.join(",")).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=HOD_Report_${month}_${year}.csv`,
    );

    return res.send(csv);
  } catch (err) {
    return res.status(500).json({
      message: "HOD CSV generation failed",
      error: err.message,
    });
  }
};

exports.downloadHodReportPDF = async (req, res) => {
  try {
    const { physioId, referenceId, month, year, role } = req.body;

    // ---------------- ACCESS CHECK ----------------
    if (role !== "HOD") {
      return res.status(403).json({ message: "Access denied" });
    }

    // ---------------- DATE RANGE ----------------
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // ---------------- DATA FETCH ----------------
    const sessions = await Session.find({
      sessionDate: { $gte: startDate, $lte: endDate },
    }).populate("patientId sessionStatusId");

    const reviews = await ReviewModel.find({
      reviewDate: { $gte: startDate, $lte: endDate },
    }).populate("reviewStatusId");

    const consultations = await ConsultationModel.find({
      consultationDate: { $gte: startDate, $lte: endDate },
    });

    const leads = await Lead.find({
      createdAt: { $gte: startDate, $lte: endDate },
    });

    // ---------------- STATS CALCULATION ----------------
    let completedSessions = 0;
    let cancelledSessions = 0;
    let patients = new Set();

    sessions.forEach((s) => {
      const status = (s.sessionStatusId?.sessionStatusName || "").toLowerCase();

      if (status.includes("completed")) completedSessions++;
      else if (status.includes("cancel")) cancelledSessions++;

      if (s.patientId) patients.add(String(s.patientId));
    });

    const completedReviews = reviews.filter(
      (r) => (r.reviewStatusId?.reviewStatusName || "") === "Completed",
    ).length;

    const pendingReviews = reviews.length - completedReviews;

    const completedConsultations = consultations.filter(
      (c) => c.physioId && c.sessionStartDate,
    ).length;

    const pendingConsultations = consultations.filter(
      (c) => !c.physioId || !c.sessionStartDate,
    ).length;

    const convertedLeads = consultations.filter((c) => c.leadId).length;

    // ---------------- PDF SETUP ----------------
    const doc = new jsPDF();

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const reportMonth = monthNames[month - 1];

    // ---------------- HEADER (FIXED ALIGNMENT) ----------------
    doc.addImage(logoBase64, "PNG", 10, 6, 25, 25);

    const textX = 45; // aligned with logo center

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("NEO PHYSIO", textX, 16);

    doc.setFontSize(14);
    doc.text("HOD REPORT", textX, 24);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Month: ${reportMonth} ${year}`, textX, 31);
    doc.text(`Generated: ${new Date().toLocaleString()}`, textX, 37);

    // ---------------- LINE (FIXED ALIGNMENT) ----------------
    doc.setLineWidth(0.5);
    doc.line(10, 42, 200, 42);

    // ---------------- TABLE ----------------
    autoTable(doc, {
      startY: 50,
      head: [["Metric", "Value"]],
      body: [
        ["Total Sessions", sessions.length],
        ["Completed Sessions", completedSessions],
        ["Cancelled Sessions", cancelledSessions],
        ["Total Patients", patients.size],

        ["Total Reviews", reviews.length],
        ["Completed Reviews", completedReviews],
        ["Pending Reviews", pendingReviews],

        ["Total Consultations", consultations.length],
        ["Completed Consultations", completedConsultations],
        ["Pending Consultations", pendingConsultations],

        ["Total Leads", leads.length],
        ["Converted Leads", convertedLeads],
      ],
      theme: "grid",
      headStyles: {
        fillColor: [0, 102, 204],
        textColor: 255,
        fontStyle: "bold",
        halign: "center",
      },
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      columnStyles: {
        0: { halign: "left" },
        1: { halign: "center" },
      },
    });

    // ---------------- RESPONSE ----------------
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=HOD_Report_${month}_${year}.pdf`,
    );

    return res.send(pdfBuffer);
  } catch (err) {
    return res.status(500).json({
      message: "HOD PDF generation failed",
      error: err.message,
    });
  }
};
exports.downloadPatientListXLSX = async (req, res) => {
  try {
    const { physioId, referenceId, month, year } = req.body;

    // ---------------- FILTER ----------------
    const filter = {};

    if (physioId && physioId !== "all") {
      filter.physioId = physioId;
    }

    if (referenceId && referenceId !== "all") {
      filter.ReferenceId = referenceId;
    }

    // ---------------- FETCH DATA ----------------
    const patients = await PatientModel.find(filter)
      .populate("physioId")
      .populate("patientGenderId")
      .populate("ReferenceId");
    const patientIds = patients.map((p) => p._id);

    // optional date filter (only if month/year provided)
    let matchFilter = {
      patientId: { $in: patientIds },
    };

    if (month && year) {
      const m = Number(month);
      const y = Number(year);

      if (!isNaN(m) && !isNaN(y)) {
        const startDate = new Date(y, m - 1, 1);
        const endDate = new Date(y, m, 0, 23, 59, 59, 999);

        matchFilter.sessionDate = { $gte: startDate, $lte: endDate };
      }
    }

    // 🔥 aggregation
    const sessionStats = await Session.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: "$patientId",
          totalSessions: { $sum: 1 },
        },
      },
    ]);

    // convert to map
    const sessionMap = {};
    sessionStats.forEach((s) => {
      sessionMap[String(s._id)] = s.totalSessions;
    });
    // ---------------- WORKBOOK ----------------
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Patients");

    sheet.columns = [
      { header: "S.No", key: "sno", width: 8 },
      { header: "Patient Code", key: "code", width: 15 },
      { header: "Patient Name", key: "name", width: 25 },
      { header: "Mobile Number", key: "mobile", width: 18 },
      { header: "Gender", key: "gender", width: 12 },
      { header: "Age", key: "age", width: 10 },
      { header: "Address", key: "address", width: 25 },
      { header: "Condition", key: "condition", width: 25 },
      { header: "Physio", key: "physio", width: 20 },
      { header: "Reference", key: "reference", width: 20 },
      { header: "Session Count", key: "sessions", width: 15 },
    ];

    patients.forEach((p, index) => {
      sheet.addRow({
        sno: index + 1,
        code: p.patientCode || "N/A",
        name: p.patientName || "N/A",
        mobile: p.patientNumber || "N/A",
        gender: p.patientGenderId?.genderName || "N/A",
        age: p.patientAge || "N/A",
        address: p.patientAddress || "N/A",
        condition: p.patientCondition || "N/A",
        physio: p.physioId?.physioName || "N/A",
        reference: p.ReferenceId?.sourceName || "N/A",
        sessions: sessionMap[String(p._id)] || 0,
      });
    });

    // ---------------- RESPONSE ----------------
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=patient-list.xlsx",
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Error generating XLSX report",
      error: err.message,
    });
  }
};
exports.downloadPatientListPDF = async (req, res) => {
  try {
    const { physioId, referenceId, month, year } = req.body;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // ---------------- FILTER ----------------
    const patientFilter = {};

    if (physioId && physioId !== "all") {
      patientFilter.physioId = physioId;
    }

    if (referenceId && referenceId !== "all") {
      patientFilter.ReferenceId = referenceId;
    }

    // ---------------- PATIENTS ----------------
    const patients = await PatientModel.find(patientFilter)
      .populate("physioId")
      .populate("patientGenderId")
      .populate("ReferenceId");

    const patientIds = patients.map((p) => p._id);

    // ---------------- SESSIONS AGGREGATION ----------------
    const sessionStats = await Session.aggregate([
      {
        $match: {
          patientId: { $in: patientIds },
          sessionDate: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $lookup: {
          from: "sessionStatus",
          localField: "sessionStatusId",
          foreignField: "_id",
          as: "status",
        },
      },
      { $unwind: { path: "$status", preserveNullAndEmptyArrays: true } },

      {
        $group: {
          _id: "$patientId",
          totalSessions: { $sum: 1 },

          completedSessions: {
            $sum: {
              $cond: [
                {
                  $regexMatch: {
                    input: { $toLower: "$status.sessionStatusName" },
                    regex: "complete",
                  },
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const sessionMap = {};
    sessionStats.forEach((s) => {
      sessionMap[String(s._id)] = s;
    });

    // ---------------- PDF ----------------
    const doc = new jsPDF("l", "mm", "a4");

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const reportMonth = monthNames[month - 1];
    const generatedDate = new Date().toLocaleString("en-GB");
    doc.addImage(logoBase64, "PNG", 10, 5, 28, 28);

    // -------- HEADER --------
    doc.setFontSize(18);
    doc.text("NEO PHYSIO", 148, 15, { align: "center" });

    doc.setFontSize(14);
    doc.text("Patient List Report", 148, 23, { align: "center" });

    doc.setFontSize(11);
    doc.text(`Month: ${reportMonth}`, 14, 35);
    doc.text(`Year: ${year}`, 14, 41);
    doc.text(`Generated: ${generatedDate}`, 14, 47);

    // ---------------- TABLE DATA ----------------
    const tableData = patients.map((p, index) => {
      const stats = sessionMap[String(p._id)] || {};

      const totalSessions = stats.totalSessions || 0;
      const completedSessions = stats.completedSessions || 0;

      const recovered =
        p.isRecovered === true || completedSessions >= 5
          ? "Recovered"
          : "Not Recovered";

      return [
        index + 1,
        p.patientCode || "N/A",
        p.patientName || "N/A",
        p.patientNumber || "N/A",
        p.patientGenderId?.genderName || "N/A",
        p.patientAge || "N/A",
        p.patientCondition || "N/A",
        p.physioId?.physioName || "N/A",
        p.ReferenceId?.sourceName || "N/A",
        totalSessions,
        recovered,
      ];
    });

    // -------- TABLE --------
    autoTable(doc, {
      startY: 55,
      head: [
        [
          "S.No",
          "Code",
          "Name",
          "Mobile",
          "Gender",
          "Age",
          "Condition",
          "Physio",
          "Reference",
          "Sessions",
          "Status",
        ],
      ],
      body: tableData,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
      },
      theme: "grid",
    });

    const pdfBuffer = doc.output("arraybuffer");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=patient-list.pdf",
    );

    return res.send(Buffer.from(pdfBuffer));
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Error generating PDF report",
      error: err.message,
    });
  }
};

exports.exportHodPerformanceReport = async (req, res) => {
  try {
    const { months = 1, type = "pdf" } = req.body;

    const m = Number(months);
    if (!m || isNaN(m)) {
      return res.status(400).json({ message: "Invalid months value" });
    }

    // ---------------- DATE RANGE ----------------
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - m);

    // ---------------- REVIEWS ----------------
    const reviewStats = await ReviewModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $lookup: {
          from: "reviewstatuses",
          localField: "reviewStatusId",
          foreignField: "_id",
          as: "reviewStatus",
        },
      },
      {
        $unwind: {
          path: "$reviewStatus",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },

          completedReviews: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    { $toLower: "$reviewStatus.reviewStatusName" },
                    "completed",
                  ],
                },
                1,
                0,
              ],
            },
          },

          pending: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    { $toLower: "$reviewStatus.reviewStatusName" },
                    "pending",
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // ---------------- LEAD CONSULTATIONS ----------------
    const leadConsultations = await ConsultationModel.countDocuments({
      leadId: { $exists: true, $ne: null },
      createdAt: { $gte: startDate, $lte: endDate },
    });

    // ---------------- CONVERTED PATIENTS ----------------
    const convertedPatients = await PatientModel.countDocuments({
      isFromLead: true,
      leadId: { $exists: true, $ne: null },
      createdAt: { $gte: startDate, $lte: endDate },
    });

    // ---------------- SAFE DATA ----------------
    const reviewData = reviewStats[0] || {};

    const totalReviews = reviewData.totalReviews || 0;
    const completedReviews = reviewData.completedReviews || 0;
    const pending = reviewData.pending || 0;

    const totalConsultations = leadConsultations;

    // ---------------- CONVERSION RATE ----------------
    const conversionRate =
      totalConsultations > 0
        ? ((convertedPatients / totalConsultations) * 100).toFixed(2)
        : 0;
    // -------- CHART DATA --------
    const width = 600;
    const height = 400;

    const chartJSNodeCanvas = new ChartJSNodeCanvas({
      width,
      height,
      backgroundColour: "white",
    });

    const configuration = {
      type: "bar",
      data: {
        labels: [
          "Lead Consultations",
          "Converted Patients",
          "Completed Reviews",
          "Pending Reviews",
        ],
        datasets: [
          {
            label: "Performance",
            data: [
              totalConsultations,
              convertedPatients,
              completedReviews,
              pending,
            ],
            backgroundColor: ["#3498db", "#2ecc71", "#27ae60", "#e74c3c"],
          },
        ],
      },
      options: {
        plugins: {
          legend: { display: false },
        },
      },
    };

    const chartImage = await chartJSNodeCanvas.renderToBuffer(configuration);
    // ================= PDF =================
    if (type === "pdf") {
      const doc = new jsPDF();

      const generatedDate = new Date().toLocaleString("en-GB");
      doc.addImage(logoBase64, "PNG", 10, 5, 28, 28);

      // -------- HEADER --------
      doc.setFontSize(18);
      doc.text("NEO PHYSIO", 105, 15, { align: "center" });

      doc.setFontSize(14);
      doc.text("HOD Performance Report", 105, 23, { align: "center" });

      doc.setFontSize(11);
      doc.text(`Last ${m} Months Report`, 105, 30, { align: "center" });

      doc.setFontSize(10);
      doc.text(`Generated: ${generatedDate}`, 14, 40);

      // -------- TABLE --------
      autoTable(doc, {
        startY: 50,
        head: [["Metric", "Value"]],
        body: [
          ["Lead Consultations", totalConsultations],
          ["Converted Patients (From Lead)", convertedPatients],
          ["Conversion Rate", `${conversionRate}%`],
          ["Total Reviews", totalReviews],
          ["Completed Reviews", completedReviews],
          ["Pending Reviews", pending],
        ],
        theme: "grid",
        headStyles: {
          fillColor: [41, 128, 185],
        },
      });
      const finalY = doc.lastAutoTable.finalY || 60;

      doc.setFontSize(12);
      doc.text("Performance Chart", 105, finalY + 15, { align: "center" });

      doc.addImage(chartImage, "PNG", 40, finalY + 20, 130, 80);
      const pdfBuffer = doc.output("arraybuffer");

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=HOD_Performance_${m}_Months.pdf`,
      );

      return res.send(Buffer.from(pdfBuffer));
    }

    // ================= EXCEL =================
    if (type === "excel") {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("HOD Performance");

      sheet.columns = [
        { header: "Metric", key: "metric", width: 35 },
        { header: "Value", key: "value", width: 20 },
      ];

      sheet.addRows([
        { metric: "Lead Consultations", value: totalConsultations },
        { metric: "Converted Patients (From Lead)", value: convertedPatients },
        { metric: "Conversion Rate", value: `${conversionRate}%` },
        { metric: "Total Reviews", value: totalReviews },
        { metric: "Completed Reviews", value: completedReviews },
        { metric: "Pending Reviews", value: pending },
      ]);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename=HOD_Performance_${m}_Months.xlsx`,
      );

      await workbook.xlsx.write(res);
      return res.end();
    }

    return res.status(400).json({ message: "Invalid type (pdf/excel)" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Error generating HOD performance report",
      error: err.message,
    });
  }
};
exports.exportPhysioPerformanceReport = async (req, res) => {
  try {
    const { months = 1, physioId = "all", type = "pdf" } = req.body;

    const m = Number(months);

    if (!m || isNaN(m)) {
      return res.status(400).json({ message: "Invalid months value" });
    }

    // DATE RANGE
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - m);

    // FILTER
    const match = {
      sessionDate: { $gte: startDate, $lte: endDate },
    };

    if (physioId !== "all") {
      match.physioId = new mongoose.Types.ObjectId(physioId);
    }

    // SESSION DATA
    const sessions = await Session.aggregate([
      { $match: match },

      {
        $lookup: {
          from: "physios",
          localField: "physioId",
          foreignField: "_id",
          as: "physio",
        },
      },

      { $unwind: "$physio" },

      {
        $lookup: {
          from: "sessionstatuses",
          localField: "sessionStatusId",
          foreignField: "_id",
          as: "status",
        },
      },

      { $unwind: { path: "$status", preserveNullAndEmptyArrays: true } },

      {
        $group: {
          _id: "$physioId",

          physioName: { $first: "$physio.physioName" },

          totalSessions: { $sum: 1 },

          completedSessions: {
            $sum: {
              $cond: [
                {
                  $regexMatch: {
                    input: { $toLower: "$status.sessionStatusName" },
                    regex: "complete",
                  },
                },
                1,
                0,
              ],
            },
          },

          cancelledSessions: {
            $sum: {
              $cond: [
                {
                  $regexMatch: {
                    input: { $toLower: "$status.sessionStatusName" },
                    regex: "cancel",
                  },
                },
                1,
                0,
              ],
            },
          },

          pendingSessions: {
            $sum: {
              $cond: [
                {
                  $regexMatch: {
                    input: { $toLower: "$status.sessionStatusName" },
                    regex: "scheduled",
                  },
                },
                1,
                0,
              ],
            },
          },

          patients: { $addToSet: "$patientId" },
        },
      },
    ]);

    // CALCULATE REPORT DATA
    const reportData = sessions.map((p) => {
      const uniquePatients = p.patients.length;

      const avgSessionsPerPatient =
        uniquePatients === 0
          ? 0
          : (p.totalSessions / uniquePatients).toFixed(2);

      const sessionCompletionRate =
        p.totalSessions === 0
          ? 0
          : Math.round((p.completedSessions / p.totalSessions) * 100);

      return {
        physioName: p.physioName,
        totalSessions: p.totalSessions,
        completedSessions: p.completedSessions,
        cancelledSessions: p.cancelledSessions,
        pendingSessions: p.pendingSessions,
        uniquePatients,
        avgSessionsPerPatient,
        sessionCompletionRate,
      };
    });

    // ================= PDF =================
    if (type === "pdf") {
      const doc = new jsPDF("landscape");
      doc.addImage(logoBase64, "PNG", 10, 5, 28, 28);

      doc.setFontSize(18);
      doc.text("NEO PHYSIO", 148, 15, { align: "center" });

      doc.setFontSize(14);
      doc.text("Physio Performance Report", 148, 23, { align: "center" });

      doc.setFontSize(11);
      doc.text(`Last ${m} Months`, 148, 30, { align: "center" });

      const generatedDate = new Date().toLocaleString("en-GB");

      doc.setFontSize(10);
      doc.text(`Generated: ${generatedDate}`, 14, 40);

      // CHART GENERATION
      const width = 800;
      const height = 300;

      const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

      const labels = reportData.map((p) => p.physioName);

      const completed = reportData.map((p) => p.completedSessions);
      const cancelled = reportData.map((p) => p.cancelledSessions);
      const pending = reportData.map((p) => p.pendingSessions);

      const configuration = {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Completed Sessions",
              data: completed,
              backgroundColor: "green",
            },
            {
              label: "Cancelled Sessions",
              data: cancelled,
              backgroundColor: "red",
            },
            {
              label: "Pending Sessions",
              data: pending,
              backgroundColor: "orange",
            },
          ],
        },
      };

      const chartImage = await chartJSNodeCanvas.renderToBuffer(configuration);

      doc.addImage(chartImage, "PNG", 15, 50, 260, 80);

      // TABLE DATA
      const tableRows = reportData.map((p, index) => [
        index + 1,
        p.physioName,
        p.totalSessions,
        p.completedSessions,
        p.cancelledSessions,
        p.pendingSessions,
        p.uniquePatients,
        p.avgSessionsPerPatient,
        p.sessionCompletionRate + "%",
      ]);

      autoTable(doc, {
        startY: 140,
        head: [
          [
            "S.No",
            "Physio",
            "Total Sessions",
            "Completed",
            "Cancelled",
            "Pending",
            "Unique Patients",
            "Avg Sessions / Patient",
            "Session Completion Rate %",
          ],
        ],
        body: tableRows,
      });

      const pdfBuffer = doc.output("arraybuffer");

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Physio_Performance_${m}_Months.pdf`,
      );

      return res.send(Buffer.from(pdfBuffer));
    }

    // ================= EXCEL =================
    if (type === "excel") {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Physio Performance");

      sheet.columns = [
        { header: "Physio", key: "physioName", width: 30 },
        { header: "Total Sessions", key: "totalSessions", width: 15 },
        { header: "Completed", key: "completedSessions", width: 15 },
        { header: "Cancelled", key: "cancelledSessions", width: 15 },
        { header: "Pending", key: "pendingSessions", width: 15 },
        { header: "Unique Patients", key: "uniquePatients", width: 15 },
        {
          header: "Avg Sessions / Patient",
          key: "avgSessionsPerPatient",
          width: 20,
        },
        {
          header: "Session Completion Rate %",
          key: "sessionCompletionRate",
          width: 20,
        },
      ];

      sheet.addRows(reportData);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Physio_Performance_${m}_Months.xlsx`,
      );

      await workbook.xlsx.write(res);
      return res.end();
    }

    return res.status(400).json({ message: "Invalid type" });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error generating physio performance report",
      error: err.message,
    });
  }
};
exports.exportHodReviewReport = async (req, res) => {
  try {
    const { month, year, referenceId = "all", type = "pdf" } = req.body;

    if (!month || !year) {
      return res.status(400).json({ message: "Month and Year required" });
    }

    const startDate = new Date(Number(year), Number(month) - 1, 1);
    const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);

    // ===== FILTER =====
    const filter = {
      reviewDate: { $gte: startDate, $lte: endDate },
    };

    if (referenceId && referenceId !== "all") {
      filter.referenceId = new mongoose.Types.ObjectId(referenceId);
    }

    const reviews = await ReviewModel.find(filter)
      .populate("patientId", "patientName")
      .populate("physioId", "physioName")
      .populate("referenceId", "sourceName")
      .populate("reviewStatusId", "reviewStatusName");

    // ================= PDF =================
    if (type === "pdf") {
      const doc = new jsPDF("landscape");

      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];

      const reportMonth = monthNames[month - 1];
      const generatedDate = new Date().toLocaleString("en-GB");
      doc.addImage(logoBase64, "PNG", 10, 5, 28, 28);

      // ===== HEADER =====
      doc.setFontSize(18);
      doc.text("NEO PHYSIO", 148, 12, { align: "center" });

      doc.setFontSize(14);
      doc.text("HOD REVIEW REPORT", 148, 20, { align: "center" });

      doc.setFontSize(11);
      doc.text(`Month: ${reportMonth}`, 14, 32);
      doc.text(`Year: ${year}`, 14, 38);
      doc.text(`Generated: ${generatedDate}`, 14, 44);

      // ===== TABLE DATA =====
      const rows = reviews.map((r, i) => [
        i + 1,
        new Date(r.reviewDate).toLocaleDateString(),
        r.patientId?.patientName || "N/A",
        r.physioId?.physioName || "N/A",
        r.referenceId?.sourceName || "N/A",
        r.reviewStatusId?.reviewStatusName || "N/A",
        r.feedback || "N/A",
      ]);

      // ===== TABLE =====
      autoTable(doc, {
        startY: 50, // ⬅️ FIXED spacing
        head: [
          ["S.No", "Date", "Patient", "Physio", "Reference", "Status", "Notes"],
        ],
        body: rows,

        styles: {
          fontSize: 9,
          cellPadding: 3,
          valign: "middle",
        },

        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          halign: "center",
        },

        columnStyles: {
          0: { halign: "center", cellWidth: 15 },
          1: { cellWidth: 25 },
          2: { cellWidth: 45 },
          3: { cellWidth: 45 },
          4: { cellWidth: 40 },
          5: { cellWidth: 35 },
          6: { cellWidth: "auto" },
        },
      });

      const pdf = doc.output("arraybuffer");

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=HOD_Review_Report_${month}_${year}.pdf`,
      );

      return res.send(Buffer.from(pdf));
    }

    // ================= EXCEL =================
    if (type === "excel") {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Reviews");

      sheet.columns = [
        { header: "Date", key: "reviewDate", width: 15 },
        { header: "Patient", key: "patientName", width: 25 },
        { header: "Physio", key: "physioName", width: 25 },
        { header: "Reference", key: "referenceName", width: 25 },
        { header: "Status", key: "statusName", width: 20 },
        { header: "Notes", key: "feedback", width: 40 },
      ];

      // HEADER STYLE
      sheet.getRow(1).font = { bold: true };

      reviews.forEach((r) => {
        sheet.addRow({
          reviewDate: new Date(r.reviewDate).toLocaleDateString(),
          patientName: r.patientId?.patientName || "N/A",
          physioName: r.physioId?.physioName || "N/A",
          referenceName: r.referenceId?.sourceName || "N/A",
          statusName: r.reviewStatusId?.reviewStatusName || "N/A",
          feedback: r.feedback || "N/A",
        });
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename=HOD_Review_Report_${month}_${year}.xlsx`,
      );

      await workbook.xlsx.write(res);
      return res.end();
    }

    return res.status(400).json({ message: "Invalid type" });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error generating review report",
      error: err.message,
    });
  }
};
