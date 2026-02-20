const express = require("express");
const router = express.Router();

const LeadControllers = require("../controllers/mainControllers/LeadControllers");
const physioControllers = require("../controllers/mainControllers/PhysioControllers");
const PatientControllers = require("../controllers/mainControllers/PatientControllers");
const ExpenseControllers = require("../controllers/mainControllers/ExpenseControllers");
const SessionControllers = require("../controllers/mainControllers/SessionControllers");
const PetrolAllowanceControllers = require("../controllers/mainControllers/PetrolAllowanceControllers");
const DashBoardControllers = require("../controllers/mainControllers/DashBoardControllers");
const ReviewTypeControllers = require("../controllers/mainControllers/ReviewTypeControllers");
const ReviewControllers = require("../controllers/mainControllers/ReviewControllers");
const ConsultationControllers = require("../controllers/mainControllers/ConsultationControllers");
const BillCountrollers = require("../controllers/mainControllers/BillControllers");

//Leads
router.post("/Lead/createLead", LeadControllers.createLead);
router.post("/Lead/getAllLead", LeadControllers.getAllLeads);
router.post("/Lead/getSingleLead", LeadControllers.getLeadById);
router.post("/Lead/updateLead", LeadControllers.updateLead);
router.post("/Lead/deleteLead", LeadControllers.deleteLead);
router.post("/Lead/QualifyLead", LeadControllers.QualifyLead);

//Bill
router.post("/Bill/createBill", BillCountrollers.createBill);
router.post("/Bill/getAllBill", BillCountrollers.getAllBill);
router.post("/Bill/deleteBill", BillCountrollers.deleteBill);
//Physio
router.post(
  "/Physio/createPhysio",
  physioControllers.physioUploadMiddleware,
  physioControllers.createPhysio,
);
router.post("/Physio/getAllPhysio", physioControllers.getAllPhysios);
router.post("/Physio/getSinglePhysio", physioControllers.getPhysioById);
router.post(
  "/Physio/updatePhysio",
  physioControllers.physioUploadMiddleware,
  physioControllers.updatePhysio,
);
router.post("/Physio/deletePhysio", physioControllers.deletePhysio);
//physio login

router.post("/Physio/loginPhysio", physioControllers.loginPhysio);
router.post("/Physio/logoutPhysio", physioControllers.logoutPhysio);
router.post("/Physio/logoutUser", physioControllers.logoutUser);
router.post("/Physio/checkLogin", physioControllers.checkLogin);
router.post("/Physio/markLeave", physioControllers.markLeave);
router.post("/Physio/getAllLeave", physioControllers.getAllLeave);
//Patients
router.post("/Patient/createPatient", PatientControllers.createPatients);
router.post("/Patient/getAllPatient", PatientControllers.getAllPatients);
router.post("/Patient/getSinglePatient", PatientControllers.getByPatientsName);
router.post("/Patient/updatePatient", PatientControllers.updatePatients);
router.post("/Patient/deletePatient", PatientControllers.deletePatients);
router.post(
  "/Patient/getAllPatientsIncome",
  PatientControllers.getAllPatientsIncome,
);
router.post(
  "/Patient/sessionassignphysio",
  PatientControllers.sessionAssignPhysio,
);
router.post(
  "/Patient/updatePatientGoals",
  PatientControllers.updatePatientGoals,
);
router.post(
  "/Patient/updatePatientFeedbacks",
  PatientControllers.updatePatientFeedbacks,
);
//Assign Physio
router.post("/Patient/AssignPhysio", PatientControllers.AssignPhysio);
router.post(
  "/Patient/getPhysioPatientCounts",
  PatientControllers.getPhysioPatientCounts,
);
router.post(
  "/Patient/getAllPatientsByPhysioAndDate",
  PatientControllers.getAllPatientsByPhysioAndDate,
);

//ExpenseControllers
router.post("/Expense/createExpense", ExpenseControllers.createExpense);
router.post("/Expense/getAllExpense", ExpenseControllers.getAllExpense);
router.post("/Expense/getSingleExpense", ExpenseControllers.getSingleExpense);
router.post("/Expense/updateExpense", ExpenseControllers.updateExpense);
router.post("/Expense/deleteExpense", ExpenseControllers.deleteExpense);
router.post("/Session/getMonthlySummary", SessionControllers.getMonthlySummary);
//SessionControllers
router.post("/Session/createSession", SessionControllers.createSession);
router.post(
  "/Session/getAllSessionsbyPatient",
  SessionControllers.getAllSessionsbyPatient,
);
router.post("/Session/getAllSession", SessionControllers.getAllSessions);
router.post("/Session/getSingleSession", SessionControllers.getSingleSession);
router.post("/Session/updateSession", SessionControllers.updateSession);
router.post("/Session/deleteSession", SessionControllers.deleteSession);
router.post("/Session/sessionStop", SessionControllers.sessionStop);
router.post(
  "/Session/deleteDuplicateSession",
  SessionControllers.deleteDuplicateSession,
);
router.post(
  "/Session/sessionCancelRevert",
  SessionControllers.sessionCancelRevert,
);
//Session Start and End

router.post("/Session/SessionStart", SessionControllers.SessionStart);
router.post("/Session/SessionEnd", SessionControllers.SessionEnd);
router.post("/Session/SessionCancel", SessionControllers.SessionCancel);

//PetrolAllowanceControllers

router.post(
  "/PetrolAllowance/getAllPetrolAllowance",
  PetrolAllowanceControllers.getAllPetrol,
);
router.post("/Physio/saveLeavePlan", physioControllers.saveLeavePlan);
//DashBoardControllers
router.post("/DashBoard/getAllDashBoard", DashBoardControllers.getAllDashBoard);
router.post("/DashBoard/monthlyfunnel", DashBoardControllers.monthlyfunnel);
router.post("/DashBoard/getIncomeByDate", DashBoardControllers.getIncomeByDate);
router.post("/Dashboard/getTodayIncome", DashBoardControllers.getTodayIncome);
//ConsultationControllers
router.post(
  "/Consultation/createConsultation",
  ConsultationControllers.createConsultation,
);
router.post(
  "/Consultation/getAllConsultation",
  ConsultationControllers.getAllConsultation,
);
router.post(
  "/Consultation/getSingleConsultation",
  ConsultationControllers.getByConsultationName,
);
router.post(
  "/Consultation/updateConsultation",
  ConsultationControllers.updateConsultation,
);
router.post(
  "/Consultation/deleteConsultation",
  ConsultationControllers.deleteConsultation,
);
router.post("/Consultation/AssignPhysio", ConsultationControllers.AssignPhysio);
router.post(
  "/Consultation/revertConsultation",
  ConsultationControllers.revertConsultation,
);

router.post("/RedFlag/CreateRedFlag", ReviewControllers.createRedflag);
router.post("/RedFlag/GetAllRedFlag", ReviewControllers.getAllRedflags);
module.exports = router;
