import { Router } from "express";
import * as archiveController from "../controllers/archive.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/", archiveController.getArchiveClips);
router.get("/:id", archiveController.getArchiveClipById);
router.get("/:id/video", archiveController.streamVideo);

export default router;
