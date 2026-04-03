const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: "./uploads/leads/",
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname),
    );
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 100000000 },
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
}).array("leadDocuments", 10);

function checkFileType(file, cb) {
  const filetypes =
    /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|mp4|mkv|avi|mov|webm/;

  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb("Error: Files of this type are not allowed!");
  }
}

module.exports = upload;
