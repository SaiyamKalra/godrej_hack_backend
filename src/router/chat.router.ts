import {Router} from "express";
import { createChatMessage,getChatMessage,getRecentChats,deleteChat, searchChat } from "../controllers/chat.controller";

const router=Router();

router.post("/",createChatMessage);
router.get("/recent/:userId", getRecentChats);
router.get("/:chatId/messages",getChatMessage);
router.get("/search",searchChat);
router.delete("/:chatId", deleteChat);
export default router;