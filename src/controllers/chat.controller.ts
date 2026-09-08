import { Request,Response } from "express";
import { sendMessage,getMessage,getRecentChatsService, searchChatServices,deleteChatService } from "../services/chat.service.js";

export async function createChatMessage(
  req: Request,
  res: Response
) {
  try {
    const userId=req.user!.uid;
    const { chatId, message } = req.body;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({
        error: "userId is required",
        status: 0,
      });
    }

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "message is required",
        status: 0,
      });
    }

    // Enable HTTP streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    res.flushHeaders();

    // Ensure user exists in database
    const email = req.user!.email || "user@example.com";
    const name = req.user!.name || "User";
    const { syncFirebaseUser } = await import("../services/user.service.js");
    await syncFirebaseUser(userId, email, name);

    const result = await sendMessage({
      userId,
      chatId,
      message,

      onChunk: (content) => {
        res.write(
          `data: ${JSON.stringify({
            type: "chunk",
            content,
          })}\n\n`
        );
      },
    });

    // Tell client that generation is finished
    res.write(
      `data: ${JSON.stringify({
        type: "done",
        chatId: result.chatId,
        messageId: result.message.messageId,
        role: result.message.role,
        content: result.message.content,
        createdAt: result.message.createdAt,
      })}\n\n`
    );

    res.end();

  } catch (err) {
    console.error("Error in creating a chat", err);

    if (!res.headersSent) {
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

    res.write(
      `data: ${JSON.stringify({
        type: "error",
        message: "Internal Server Error",
      })}\n\n`
    );

    res.end();
  }
}

export async function getChatMessage(req:Request,res:Response){
    try{
        const chatId=req.params.chatId;
        const userId=req.user!.uid;
        const {cursor,limit}=req.query;

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

        const parsedLimit = typeof limit === "string" ? Number.parseInt(limit, 10) : 20;

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
            cursor: typeof cursor === "string" ? cursor : undefined,
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

        const userId = req.user!.uid;


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

export async function searchChat(
  req: Request,
  res: Response
) {
  try {
    const userId=req.user!.uid;
    const { q } = req.query;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({
        error: "userId is required",
        status: 0,
      });
    }

    if (!q || typeof q !== "string") {
      return res.status(400).json({
        error: "search query is required",
        status: 0,
      });
    }

    const query = q.trim();

    if (!query) {
      return res.status(400).json({
        error: "search query cannot be empty",
        status: 0,
      });
    }

    const chats = await searchChatServices(
      userId,
      query
    );

    return res.status(200).json({
      chats,
      status: 1,
    });

  } catch (err) {
    console.error("Error searching chats:", err);

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

        const userId = req.user!.uid;


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