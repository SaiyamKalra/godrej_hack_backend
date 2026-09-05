import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { syncUser } from "../controllers/auth.controller.js";

const router = Router();

router.post("/sync", authenticate, syncUser);

export default router;