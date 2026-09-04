import express from "express";
import dotenv from "dotenv";
import chatRouter from "./router/chat.router";
import authRoutes from "./router/auth.router";
import cors from "cors";
dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());
app.use("/api/chat",chatRouter);
app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Godrej backend is running",
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});