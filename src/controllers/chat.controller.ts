import { Request,Response } from "express";
import { sendMessage,getMessage,getRecentChatsService,deleteChatService } from "../services/chat.service";
export async function createChatMessage(req:Request,res:Response){
    try{
        const {userId,chatId,message}=req.body;
        
        if(!message || typeof message!="string"){
            return res.status(400).json({
                error:"message is required",
                status:0,
            });
        };

        const result=await sendMessage({
            userId,
            chatId,
            message,
        });

        return res.status(200).json({
            message:result,
            status:1,
        })
    }
    catch(err){
        console.error("Error in creating a chat",err);
        res.status(500).json({
            message:"Internal Server Error",
            status:0,
        })
    }
}

export async function getChatMessage(req:Request,res:Response){
    try{
        const chatId=req.params.chatId;
        const {userId,cursor,limit}=req.query;

        if (typeof chatId !== "string") {
            return res.status(400).json({
                message: "chat Id not found",
                status: 0,
            });
        }
        if(!chatId){
            return res.status(400).json({
                message:"chat Id not found",
                status:0,
            })
        }

        if(!userId || typeof userId!=="string"){
            return res.status(400).json({
                error: "userId is required",
            });
        }

        const parsedLimit=typeof limit ==="string" ? Number.parseInt(limit,10):20;
        
        if (
            !Number.isInteger(parsedLimit) ||
            parsedLimit < 1 ||
            parsedLimit > 100
        ) {
        return res.status(400).json({
            error: "limit must be between 1 and 100",
        });
        }

        const result = await getMessage({
            userId,
            chatId,
            cursor:
                typeof cursor === "string"
                ? cursor
                : undefined,
            limit: parsedLimit,
        });

        return res.status(200).json(result);
    }
    catch(err){
        console.error("Error in fetching the chat",err);
        res.status(500).json({
            message:"Internal Server Error",
            status:0,
        })
    }
}

export async function getRecentChats(
    req: Request,
    res: Response
) {
    try {

        const userId = req.params.userId;


        if (typeof userId !== "string") {
            return res.status(400).json({
                message: "userId is required",
                status: 0,
            });
        }


        const chats =
            await getRecentChatsService(userId);


        return res.status(200).json({
            chats,
            status: 1,
        });

    } catch (err) {

        console.error(
            "Error in fetching recent chats",
            err
        );


        return res.status(500).json({
            message: "Internal Server Error",
            status: 0,
        });
    }
}


export async function deleteChat(
    req: Request,
    res: Response
) {
    try {

        const chatId = req.params.chatId;


        if (typeof chatId !== "string") {
            return res.status(400).json({
                message: "chat Id not found",
                status: 0,
            });
        }


        const {
            userId,
        } = req.body;


        if (!userId || typeof userId !== "string") {
            return res.status(400).json({
                error: "userId is required",
                status: 0,
            });
        }


        await deleteChatService({
            userId,
            chatId,
        });


        return res.status(200).json({
            message: "Chat deleted successfully",
            status: 1,
        });

    } catch (err) {

        console.error(
            "Error in deleting chat",
            err
        );


        if (
            err instanceof Error &&
            err.message === "Chat not found"
        ) {
            return res.status(404).json({
                message: "Chat not found",
                status: 0,
            });
        }


        return res.status(500).json({
            message: "Internal Server Error",
            status: 0,
        });
    }
}