const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const path = require("path");
const bodyParser = require("body-parser");
const http = require("http");
const { Server } = require("socket.io");
const cron = require("node-cron");
const masterRoutes = require("./router/masterRoutes");
const mainRoutes = require("./router/mainRoutes");
const CronJobControllers = require("./controllers/mainControllers/CronJobControllers");
// const authRoutes = require('./routes/authRoutes');

// --- UNCOMMENTED FOR NOTIFICATIONS ---
const Notification = require("./model/masterModels/Notification");
// const Group = require('./models/masterModels/Group');
// const Message = require('./models/masterModels/Message');

// const logoutUser = require('./controllers/masterControllers/EmployeeControllers');
// const autoCheckoutOnDisconnect = require('./controllers/masterControllers/AttendanceControllers');

const app = express();
const PORT = 8001;

// app.use(bodyParser.json());
app.use(
  express.json(
    {
      verify: (req, res, buf) => {
        req.rawBody = buf; // Save the raw buffer to the request object
      },
    },
    { limit: "10mb" },
  ),
);
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  }),
);
require("dotenv").config();

// app.post('/api/chatWithGemini', (req,res)=>{
//   console.log(req.body,"req.body")
// })
app.get("/privacy", (req, res) => {
  res.send(`
    <h1>Privacy Policy</h1>
    <p>We collect and process data such as employee names, phone numbers, email addresses, and task details.</p>
    <p>This data is used solely for notifying employees about assigned tasks via WhatsApp and for internal task management purposes.</p>
    <p>We do not share, sell, or distribute this information to third parties.</p>
    <p>If you wish to opt-out or request data deletion, please contact eethalnaditsolutions@gmail.com.</p>
  `);
});
app.use("/physioPic", express.static(path.join(__dirname, "physioPic")));
app.use("/api", masterRoutes);
app.use("/api", mainRoutes);

app.get("/test", (req, res) => {
  res.send("Testing mongo db url");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

CronJobControllers.initSessionCron(io);
CronJobControllers.initMonthlyBillingGeneration(io);
CronJobControllers.initDailySessionGeneration(io);
CronJobControllers.initScheduledReviewGeneration(io);
CronJobControllers.initReturnJourneyAllowanceCron(io);
CronJobControllers.initMonthlyPayrollCron();
// const io = new Server(server, {
//   cors: {
//     origin: "https://enishrm.grss.in",
//     methods: ["GET", "POST"],
//     credentials: true
//   }
// });

// app.set("socketio", io);

const employeeSockets = new Map(); // employeeId -> Set of socketIds

io.on("connection", (socket) => {
  console.log("⚡ A client connected:", socket.id);

  // ================== Join Room for Personal Notifications ==================
  socket.on("joinRoom", ({ employeeId }) => {
    socket.employeeId = employeeId;
    socket.join(employeeId);

    if (!employeeSockets.has(employeeId)) {
      employeeSockets.set(employeeId, new Set());
    }
    employeeSockets.get(employeeId).add(socket.id);

    console.log(`Socket ${socket.id} joined personal room: ${employeeId}`);
  });

  // ================== Send Message (Notification) ==================
  socket.on(
    "sendMessage",
    async ({
      type,
      message,
      toEmployeeId = null,
      groupId = null,
      meta = {},
    }) => {
      try {
        const notification = await createNotification({
          type,
          message,
          fromEmployeeId: socket.employeeId,
          toEmployeeId,
          groupId,
          meta,
        });

        console.log("✅ Notification created:", notification._id);
      } catch (err) {
        console.error("❌ Error sending notification:", err.message);
      }
    },
  );

  // ================== Disconnect ==================
  socket.on("disconnect", () => {
    const { employeeId } = socket;
    if (employeeId && employeeSockets.has(employeeId)) {
      const sockets = employeeSockets.get(employeeId);
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        employeeSockets.delete(employeeId);
      }
    }
    console.log(`❌ Socket disconnected: ${socket.id}`);
  });
});

// ---------------- HELPER: CREATE NOTIFICATION ----------------
const createNotification = async ({
  type,
  message,
  fromEmployeeId,
  toEmployeeId = null,
  groupId = null,
  meta = {},
}) => {
  try {
    const notificationData = {
      type,
      message,
      fromEmployeeId,
      toEmployeeId,
      groupId,
      meta,
    };

    // Specific logic for notification status
    if (["leave-request", "permission-request"].includes(type)) {
      notificationData.status = "unseen";
    } else {
      notificationData.status = "seen";
    }

    const notification = await Notification.create(notificationData);

    // Emit via socket if online
    if (toEmployeeId) {
      io.to(toEmployeeId.toString()).emit("receiveNotification", notification);
    }
    // Group chat emission remains commented out/skipped as requested

    return notification;
  } catch (err) {
    console.error("❌ Error creating notification:", err.message);
    throw err;
  }
};

// ---------------- MONGODB CONNECTION ----------------
async function main() {
  try {
    await mongoose.connect(
      // "mongodb+srv://restore_admin:enisdevteam123@enistechteam.owwtldg.mongodb.net/neo-physio?retryWrites=true&w=majority&appName=NEO-PHYSIO",
      "mongodb+srv://enisbehinderz_db_user:Eethaldevteam123@cluster0.f2yaxih.mongodb.net/neo-physio?retryWrites=true&w=majority&appName=NEO-PHYSIO",
      {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 30000,
      },
    );

    console.log("✅ MongoDB successfully connected");

    server.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Error connecting to MongoDB:", error.message);
  }
}
// const h = new Date().getHours();
// const m = new Date().getMinutes();
// const time = `${h}.${m}`;
// const times = "18.24";
// const condition = () => {
//   if (time == times) {
//     // const name = () => {
//     console.log(time, "time");

//     console.log(
//       `check for Running corn ${new Date().getHours()}.${new Date().getMinutes()}.${new Date().getSeconds()}`,
//     );
//     // };
//   }
// };
// console.log(time, "time");

// const name = () => {
//   console.log(
//     `check for Running corn ${new Date().getHours()}.${new Date().getMinutes()}.${new Date().getSeconds()}`,
//   );
// };

main();
// cron.schedule("* * * * * *", condition);
module.exports = app;
