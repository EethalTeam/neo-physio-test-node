const express = require("express");
const router = express.Router();

const MachineCategoryControllers = require("../controllers/mastercontrollers/MachineCategoryControllers");
const MachineControllers = require("../controllers/mastercontrollers/MachineControllers");
const CityControllers = require("../controllers/mastercontrollers/CityControllers");
const CountryControllers = require("../controllers/mastercontrollers/CountryControllers");
const RedflagControllers = require("../controllers/mastercontrollers/RedflagControllers");
const StateControllers = require("../controllers/mastercontrollers/StateControllers");
const MenuControllers = require("../controllers/mastercontrollers/MenuControllers");
const ReferencesControllers = require("../controllers/mastercontrollers/ReferenceControllers");
const ExpenseCategoryControllers = require("../controllers/mastercontrollers/ExpenseCategoryControllers");
const PhysioCategoryControllers = require("../controllers/mastercontrollers/PhysioCategoryControllers");
const LeadSourceControllers = require("../controllers/mastercontrollers/LeadSourceControllers");
const GenderControllers = require("../controllers/mastercontrollers/GenderControllers");
const RiskFactorControllers = require("../controllers/mastercontrollers/RiskFactorControllers");
const ExpenseTypeController = require("../controllers/mastercontrollers/ExpenseTypeControllers");
const FeesTypeControllers = require("../controllers/mastercontrollers/FeesTypeControllers");
const LeadStatusController = require("../controllers/mastercontrollers/LeadStatusControllers");
const SessionStatusControllers = require("../controllers/mastercontrollers/SessionStatusControllers");
const ModalitiesControllers = require("../controllers/mastercontrollers/ModalitiesControllers");
const RBACControllers = require("../controllers/mastercontrollers/RBACControllers");
const ReviewControllers = require("../controllers/mainControllers/ReviewControllers");
const ReviewTypeControllers = require("../controllers/mainControllers/ReviewTypeControllers");
const ReviewStatusControllers = require("../controllers/mastercontrollers/ReviewStatusController");
// const NotificationControllers=require('../controllers/mastercontrollers/NotificationControllers')
const NotificationController = require("../controllers/mastercontrollers/NotificationControllers");

//Machinery Category Routes
router.post(
  "/MachineCategory/createMachineCategory",
  MachineCategoryControllers.createMachineCate,
);
router.post(
  "/MachineCategory/getAllMachineCategory",
  MachineCategoryControllers.getAllMachCate,
);
router.post(
  "/MachineCategory/getSingleMachineCategory",
  MachineCategoryControllers.getMachCateByName,
);
router.post(
  "/MachineCategory/updateMachineCategory",
  MachineCategoryControllers.updateMachCate,
);
router.post(
  "/MachineCategory/deleteMachineCategory",
  MachineCategoryControllers.deleteMachCate,
);

//Machinery Routes
router.post("/Machinery/createMachinery", MachineControllers.createMachine);
router.post("/Machinery/getAllMachinery", MachineControllers.getAllMachine);
router.post(
  "/Machinery/getSingleMachinery",
  MachineControllers.getMachineByName,
);
router.post("/Machinery/assignMachine", MachineControllers.assignMachine);
router.post("/Machinery/updateMachinery", MachineControllers.updateMachine);
router.post("/Machinery/deleteMachinery", MachineControllers.deleteMachine);

//CityControllers
router.post("/City/createCity", CityControllers.createCity);
router.post("/City/getAllCity", CityControllers.getAllCitys);
router.post("/City/getSingleCity", CityControllers.getCityByName);
router.post("/City/updateCity", CityControllers.updateCity);
router.post("/City/deleteCity", CityControllers.deleteCity);

//StateControllers
router.post("/State/createState", StateControllers.createState);
router.post("/State/getAllState", StateControllers.getAllStates);
router.post("/State/getSingleState", StateControllers.getStateByName);
router.post("/State/updateState", StateControllers.updateState);
router.post("/State/deleteState", StateControllers.deleteState);

//CountryControllers
router.post("/Country/createCountry", CountryControllers.createCountry);
router.post("/Country/getAllCountry", CountryControllers.getAllCountry);
router.post("/Country/getSingleCountry", CountryControllers.getCountryByName);
router.post("/Country/updateCountry", CountryControllers.updateCountry);
router.post("/Country/deleteCountry", CountryControllers.deleteCountry);

//RedflagControllers
router.post("/Redflag/createRedflag", RedflagControllers.createRedflag);
router.post("/Redflag/getAllRedflag", RedflagControllers.getAllRedflag);
router.post("/Redflag/getSingleRedflag", RedflagControllers.getRedflagByName);
router.post("/Redflag/updateRedflag", RedflagControllers.updateRedflag);
router.post("/Redflag/deleteRedflag", RedflagControllers.deleteRedflag);

//MenuControllers
router.post("/Menu/createMenu", MenuControllers.createMenu);
//  router.post('/Menu/insertManyMenus', MenuControllers.InsertMany)
router.post("/Menu/updateMenu", MenuControllers.updateMenu);
router.post("/Menu/getAllMenus", MenuControllers.getAllMenus);
router.post("/Menu/getAllParentsMenu", MenuControllers.getAllParentsMenu);
router.post("/Menu/getFormattedMenu", MenuControllers.getFormattedMenu);

//ReferencesControllers
router.post(
  "/References/createReferences",
  ReferencesControllers.createReference,
);
router.post(
  "/References/getALLReferences",
  ReferencesControllers.getAllReference,
);
router.post(
  "/References/getSingleReferences",
  ReferencesControllers.getSingleReference,
);
router.post(
  "/References/updateReferences",
  ReferencesControllers.updateReferences,
);
router.post(
  "/References/deleteReferences",
  ReferencesControllers.deleteReferences,
);

//ReviewControllers
router.post("/Review/createReview", ReviewControllers.createReview);
router.post("/Review/getAllReview", ReviewControllers.getAllReview);
router.post("/Review/getSingleReview", ReviewControllers.getReviewById);
router.post("/Review/updateReview", ReviewControllers.updateReview);
router.post("/Review/deleteReview", ReviewControllers.deleteReview);

//Review Type Routes
router.post(
  "/ReviewType/createReviewType",
  ReviewTypeControllers.createReviewType,
);
router.post(
  "/ReviewType/getAllReviewType",
  ReviewTypeControllers.getAllReviewTypes,
);
router.post(
  "/ReviewType/getReviewTypeById",
  ReviewTypeControllers.getReviewTypeById,
);
router.post(
  "/ReviewType/updateReviewType",
  ReviewTypeControllers.updateReviewType,
);
router.post(
  "/ReviewType/deleteReviewType",
  ReviewTypeControllers.deleteReviewType,
);

//Notification

router.post(
  "/Notifications/createNotifications",
  NotificationController.createNotification,
);
router.post(
  "/Notifications/getNotifications",
  NotificationController.getNotificationsByEmployee,
);
router.post(
  "/Notifications/updateNotificationStatus",
  NotificationController.updateNotificationStatus,
);
router.post("/Notifications/markAsSeen", NotificationController.markAsSeen);

//ExpenseCategoryControllers
router.post(
  "/ExpenseCategory/createExpenseCategory",
  ExpenseCategoryControllers.createExpenseCategory,
);
router.post(
  "/ExpenseCategory/getAllExpenseCategory",
  ExpenseCategoryControllers.getAllExpensesCategory,
);
router.post(
  "/ExpenseCategory/getSingleExpenseCategory",
  ExpenseCategoryControllers.getExpenseCategoryByName,
);
router.post(
  "/ExpenseCategory/updateExpenseCategory",
  ExpenseCategoryControllers.updateExpenseCategory,
);
router.post(
  "/ExpenseCategory/deleteExpenseCategory",
  ExpenseCategoryControllers.deleteExpenseCategory,
);

//ExpenseType
router.post(
  "/ExpenseType/createExpenseType",
  ExpenseTypeController.createExpenseType,
);
router.post(
  "/ExpenseType/getAllExpenseType",
  ExpenseTypeController.getAllExpensesType,
);
router.post(
  "/ExpenseType/getSingleExpenseType",
  ExpenseTypeController.getExpenseTypeByName,
);
router.post(
  "/ExpenseType/updateExpenseType",
  ExpenseTypeController.updateExpenseType,
);
router.post(
  "/ExpenseType/deleteExpenseType",
  ExpenseTypeController.deleteExpenseType,
);

//PhysioCategoryControllers
router.post(
  "/PhysioCategory/createPhysioCategory",
  PhysioCategoryControllers.createPhysioCategory,
);
router.post(
  "/PhysioCategory/getAllPhysioCategory",
  PhysioCategoryControllers.getAllPhysioCategory,
);
router.post(
  "/PhysioCategory/getSinglePhysioCategory",
  PhysioCategoryControllers.getPhysioCategoryByName,
);
router.post(
  "/PhysioCategory/updatePhysioCategory",
  PhysioCategoryControllers.updatephysioCategory,
);
router.post(
  "/PhysioCategory/deletePhysioCategory",
  PhysioCategoryControllers.deletePhysioCategory,
);

//LeadSourceControllers
router.post(
  "/LeadSource/createLeadSource",
  LeadSourceControllers.createLeadSource,
);
router.post(
  "/LeadSource/getAllLeadSource",
  LeadSourceControllers.getAllLeadSource,
);
router.post(
  "/LeadSource/getSingleLeadSource",
  LeadSourceControllers.getLeadsourceByName,
);
router.post(
  "/LeadSource/updateLeadSource",
  LeadSourceControllers.updateLeadSource,
);
router.post(
  "/LeadSource/deleteLeadSource",
  LeadSourceControllers.deleteLeadSource,
);

//GenderControllers
router.post("/Gender/createGender", GenderControllers.createGender);
router.post("/Gender/getAllGender", GenderControllers.getAllGender);
router.post("/Gender/getSingleGender", GenderControllers.getGenderByName);
router.post("/Gender/updateGender", GenderControllers.updateGender);
router.post("/Gender/deleteGender", GenderControllers.deleteGender);

//RiskFactorControllers
router.post(
  "/RiskFactor/createRiskFactor",
  RiskFactorControllers.createRiskFactor,
);
router.post(
  "/RiskFactor/getAllRiskFactor",
  RiskFactorControllers.getAllRiskFactor,
);
router.post(
  "/RiskFactor/getSingleRiskFactor",
  RiskFactorControllers.getByRiskFactorName,
);
router.post(
  "/RiskFactor/updateRiskFactor",
  RiskFactorControllers.updateRiskFactor,
);
router.post(
  "/RiskFactor/deleteRiskFactor",
  RiskFactorControllers.deleteRiskFactor,
);

//FeesTypeControllers
router.post("/FeesType/createFeesType", FeesTypeControllers.createFeesType);
router.post("/FeesType/getAllFeesType", FeesTypeControllers.getAllFeesType);
router.post(
  "/FeesType/getSingleFeesType",
  FeesTypeControllers.getFeesTypeByName,
);
router.post("/FeesType/updateFeesType", FeesTypeControllers.updateFeesType);
router.post("/FeesType/deleteFeesType", FeesTypeControllers.deleteFeesType);

//LeadStatusController
router.post(
  "/LeadStatus/createLeadStatus",
  LeadStatusController.createLeadStatus,
);
router.post(
  "/LeadStatus/getAllLeadStatus",
  LeadStatusController.getAllLeadStatus,
);
router.post(
  "/LeadStatus/getSingleLeadStatus",
  LeadStatusController.getLeadStatusByName,
);
router.post(
  "/LeadStatus/updateLeadStatus",
  LeadStatusController.updateLeadStatus,
);
router.post(
  "/LeadStatus/deleteLeadStatus",
  LeadStatusController.deleteLeadStatus,
);

//SessionStatusControllers
router.post(
  "/SessionStatus/createSessionStatus",
  SessionStatusControllers.createSessionStatus,
);
router.post(
  "/SessionStatus/getAllSessionStatus",
  SessionStatusControllers.getAllSessionStatus,
);
router.post(
  "/SessionStatus/getSingleSessionStatus",
  SessionStatusControllers.getLeadStatusByName,
);
router.post(
  "/SessionStatus/updateSessionStatus",
  SessionStatusControllers.updateSessionStatus,
);
router.post(
  "/SessionStatus/deleteSessionStatus",
  SessionStatusControllers.deleteSessionStatus,
);

//reviewStatusControllers
router.post(
  "/ReviewStatus/createReviewStatus",
  ReviewStatusControllers.createReviewStatus,
);
router.post(
  "/ReviewStatus/getAllReviewStatus",
  ReviewStatusControllers.getAllReviewStatus,
);
router.post(
  "/ReviewStatus/getSingleReviewStatus",
  ReviewStatusControllers.getLeadReviewByName,
);
router.post(
  "/ReviewStatus/updateReviewStatus",
  ReviewStatusControllers.updateReviewStatus,
);
router.post(
  "/ReviewStatus/deleteReviewStatus",
  ReviewStatusControllers.deleteReviewStatus,
);

//ModalitiesControllers
router.post(
  "/Modalities/createModalities",
  ModalitiesControllers.createModalities,
);
router.post(
  "/Modalities/getAllModalities",
  ModalitiesControllers.getAllModalities,
);
router.post(
  "/Modalities/getSingleModalities",
  ModalitiesControllers.getModalitiesByName,
);
router.post(
  "/Modalities/updateModalities",
  ModalitiesControllers.updateModalities,
);
router.post(
  "/Modalities/deleteModalities",
  ModalitiesControllers.deleteModalities,
);

//RBACControllers
router.post("/RoleBased/createRole", RBACControllers.createRole);
router.post("/RoleBased/deleteRole", RBACControllers.deleteRole);
router.post("/RoleBased/updateRole", RBACControllers.updateRole);
router.post("/RoleBased/getAllRoles", RBACControllers.getAllRoles);
router.post("/RoleBased/getAllMenus", RBACControllers.getAllMenus);
router.post(
  "/RoleBased/updateMenusAndAccess",
  RBACControllers.updateMenusAndAccess,
);
router.post(
  "/RoleBased/getPermissions",
  RBACControllers.getPermissionsByRoleAndPath,
);

module.exports = router;
