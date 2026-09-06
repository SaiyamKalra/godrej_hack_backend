import { Router } from "express";
import * as alertController from "../controllers/alert.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

// Webhook from inference service (no auth)
router.post("/webhook", alertController.createAlertFromWebhook);

// Authenticated routes
router.use(authenticate);

router.get("/", alertController.getAlerts);
router.get("/stats", alertController.getAlertStats);
router.get("/:id", alertController.getAlertById);
router.post("/:id/acknowledge", alertController.acknowledgeAlert);

export default router;
