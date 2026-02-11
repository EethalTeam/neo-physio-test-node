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
    let { fromDate, toDate } = req.body;
    let dateQuery = {};

    if (fromDate && !toDate) {
      toDate = fromDate;
      dateQuery = {
        createdAt: {
          $gte: new Date(fromDate + "T00:00:00.000Z"),
          $lte: new Date(toDate + "T23:59:59.999Z"),
        },
      };
    }

    let lead = await Leads.find(dateQuery);
    let patient = await Patients.find({
      ...dateQuery,
      isRecovered: { $ne: true },
    });
    let pendingreviews = await Review.find()
      .populate("reviewStatusId") // populates the status object
      .then((reviews) =>
        reviews.filter(
          (r) =>
            r.reviewStatusId?.reviewStatusName?.toLowerCase() === "pending",
        ),
      );
    // console.log(pendingreviews, "pendingreviews");
    let completedReview = await Review.find()
      .populate("reviewStatusId") // populates the status object
      .then((reviews) =>
        reviews.filter(
          (r) =>
            r.reviewStatusId?.reviewStatusName?.toLowerCase() === "completed",
        ),
      );
    let completedStatus = await SessionStatus.findOne({
      sessionStatusName: "Completed",
    });

    // Get the total number of completed sessions
    let completedSessionsCount = await Session.find({
      sessionStatusId: completedStatus._id,
      ...(fromDate && {
        sessionDate: {
          $gte: new Date(fromDate + "T00:00:00.000Z"),
          $lte: new Date((toDate || fromDate) + "T23:59:59.999Z"),
        },
      }),
    });

    let startDate;
    let endDate;

    if (fromDate && toDate) {
      startDate = new Date(fromDate + "T00:00:00.000Z");
      endDate = new Date(toDate + "T23:59:59.999Z");
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    let patientRecover = await PatientModel.find({
      isRecovered: true,
    });
    let patientRecovered = await PatientModel.find({
      isRecovered: true,
      recoveredType: "Patient Recovered",
    });
    let patientRecoveredOthers = await PatientModel.find({
      isRecovered: true,
      recoveredType: "Other",
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

    let sessionCompleted = await Session.find({
      sessionToTime: { $exists: true, $ne: null },
      ...(fromDate &&
        toDate && {
          sessionDate: {
            $gte: startDate,
            $lte: endDate,
          },
        }),
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
      patientRecovered: patientRecovered.length,
      patientRecoveredOthers: patientRecoveredOthers.length,
      completedReview: completedReview.length,
      patientRecover: patientRecover.length,
      // sessionCompleted: sessionCompleted.length,
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
