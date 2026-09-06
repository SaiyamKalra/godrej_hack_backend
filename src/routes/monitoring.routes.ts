import { Router } from "express";
import * as monitoringController from "../controllers/monitoring.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/stream/:cameraId", monitoringController.streamCamera);
router.get("/snapshot/:cameraId", monitoringController.snapshotCamera);

export default router;
