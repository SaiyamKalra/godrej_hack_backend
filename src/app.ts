import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import cameraRoutes from "./routes/camera.routes.js";
import alertRoutes from "./routes/alert.routes.js";
import monitoringRoutes from "./routes/monitoring.routes.js";
import archiveRoutes from "./routes/archive.routes.js";

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(cors());

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/cameras", cameraRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/monitoring", monitoringRoutes);
app.use("/api/archive", archiveRoutes);

app.use("/clips", express.static(process.env.CLIP_OUTPUT_DIR || "/app/clips"));

app.get("/", (req, res) => {
  res.json({
    message: "Godrej backend is running",
  });
});

export default app;