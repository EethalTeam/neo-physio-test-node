const mongoose = require("mongoose");
const Leads = require("../../model/masterModels/Leads");
const Patients = require("../../model/masterModels/Patient");
const Physio = require("../../model/masterModels/Physio");
const Session = require("../../model/masterModels/Session");
const Consultation = require("../../model/masterModels/Consultation");
const Review = require("../../model/masterModels/Review");
const PatientModel = require("../../model/masterModels/Patient");
const SessionStatus = require("../../model/masterModels/SessionStatus");
exports.getAllDashBoard = async (req, res) => {
  try {
    let lead = await Leads.find();
    let patient = await Patients.find();
    let pendingreviews = await Review.find()
      .populate("reviewStatusId") // populates the status object
      .then((reviews) =>
        reviews.filter(
          (r) =>
            r.reviewStatusId?.reviewStatusName?.toLowerCase() === "pending",
        ),
      );
    let completedReview = await Review.find()
      .populate("reviewStatusId") // populates the status object
      .then((reviews) =>
        reviews.filter(
          (r) =>
            r.reviewStatusId?.reviewStatusName?.toLowerCase() === "completed",
        ),
      );
    const completedStatus = await SessionStatus.findOne({
      sessionStatusName: "Completed",
    });

    // Get the total number of completed sessions
    const completedSessionsCount = await Session.find({
      sessionStatusId: completedStatus._id,
    });

    let year = new Date().getFullYear();
    let month = new Date().getMonth();
    let startDate = new Date(year, month, 1);
    let endDate = new Date(year, month + 1, 1);

    let patientRecover = await PatientModel.find({
      recoveredType: "Patient Recovered",
    });
    let physio = await Physio.find({
      roleId: new mongoose.Types.ObjectId("6926ca2ccddb76460d277717"),
      isActive: true,
    });

    let monthlySessions = await Session.find({
      sessionDate: { $gte: startDate, $lt: endDate },
    });

    console.log("Monthly sessions:", monthlySessions.length);

    // let sessionCompleted = await Session.find({
    //   sessionToTime: { $ne: null },
    // });

    const sessionCompleted = await Session.countDocuments({
      sessionToTime: { $exists: true, $ne: null },
    });

    const start = performance.now();
    let today = new Date();
    // let startDay = new Date(
    //   today.getFullYear(),
    //   today.getMonth(),
    //   today.getDate(),
    // );
    // let endDay = new Date(
    //   today.getFullYear(),
    //   today.getMonth(),
    //   today.getDate() + 1,
    // );
    const startDay = new Date();
    startDay.setHours(0, 0, 0, 0);

    const endDay = new Date();
    endDay.setHours(23, 59, 59, 999);

    let todaysession = await Session.find({
      sessionDate: { $gte: startDay, $lt: endDay },
    });

    let filter = {
      lead: lead.length,
      patient: patient.length,
      physio: physio.length,
      monthlySessions: monthlySessions.length,
      // cancelledsession: cancelledsession.length,
      pendingreviews: pendingreviews.length,
      completedReview: completedReview.length,
      patientRecover: patientRecover.length,
      sessionCompleted: sessionCompleted.length,
      sessionCompleted: completedSessionsCount.length,
      todaysession: todaysession.length,
    };

    if (!filter) {
      return res
        .status(400)
        .json({ message: "Error from backend Dashboard getAllDash" });
    }
    res.status(200).json(filter);
    const end = performance.now();
    console.log(`Time taken: in dashboard ${(end - start).toFixed(2)} ms`);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.monthlyfunnel = async (req, res) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) {
      return res.status(400).json({ message: "Month and Year are required" });
    }
    const startDate = new Date(year, month - 1, 1);
    const enddate = new Date(year, month, 1);
    const [newEnquiries, newConsultations, newPatients] = await Promise.all([
      Leads.find({
        createdAt: { $gte: startDate, $lt: enddate },
      }),
      Consultation.find({
        createdAt: { $gte: startDate, $lt: enddate },
      }),

      Patients.find({
        createdAt: { $gte: startDate, $lt: enddate },
      }),
    ]);

    const conversionRate =
      newEnquiries.length > 0
        ? ((newPatients.length / newEnquiries.length) * 100).toFixed(2)
        : 0;
    res.status(200).json({
      month,
      year,
      newEnquiries,
      newConsultations,
      newPatients,
      conversionRate,
    });
  } catch (err) {
    console.log(err);
  }
};
