import { Router } from "express";
import * as cameraController from "../controllers/camera.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.post("/", cameraController.createCamera);
router.get("/", cameraController.getCameras);
router.get("/:id", cameraController.getCameraById);
router.put("/:id", cameraController.updateCamera);
router.delete("/:id", cameraController.deleteCamera);

export default router;
