import prisma from "../lib/prisma";
import { generateChatTitle} from "./ollama.service";
import { runOllamaAgent } from "./ollama-agent.service";

interface SendMessageInput {
  userId: string;
  chatId?: string;
  message: string;
  onChunk?: (content: string) => void;
}

export async function sendMessage({
  userId,
  chatId,
  message,
  onChunk,
}: SendMessageInput) {
  let chat;

  if (chatId) {
    chat = await prisma.chat.findFirst({
      where: {
        chatId,
        userId,
      },
    });

    if (!chat) {
      throw new Error("Chat not found");
    }
  } else {
    const initialTitle=await generateChatTitle(message);
    chat = await prisma.chat.create({
      data: {
        userId,
        title: initialTitle,
      },
    });
  }

  await prisma.message.create({
    data: {
      chatId: chat.chatId,
      role: "USER",
      content: message,
    },
  });

  const previousMessages = await prisma.message.findMany({
    where: {
      chatId: chat.chatId,
    },
    orderBy: [
      {
        createdAt: "desc",
      },
      {
        messageId: "desc",
      },
    ],
    take: 20,
  });

  previousMessages.reverse();

  const ollamaMessages = previousMessages.map((msg) => ({
    role:
      msg.role === "USER"
        ? ("user" as const)
        : ("assistant" as const),
    content: msg.content,
  }));

  const assistantResponse = await runOllamaAgent(
    userId,
    ollamaMessages,
    onChunk
  );

  // Save complete response after streaming finishes
  const assistantMessage = await prisma.message.create({
    data: {
      chatId: chat.chatId,
      role: "ASSISTANT",
      content: assistantResponse,
    },
  });

  await prisma.chat.update({
    where: {
      chatId: chat.chatId,
    },
    data: {
      updatedAt: new Date(),
    },
  });

  return {
    chatId: chat.chatId,
    message: {
      messageId: assistantMessage.messageId,
      role: assistantMessage.role,
      content: assistantMessage.content,
      createdAt: assistantMessage.createdAt,
    },
  };
}

interface GetChatMessagesInput {
  userId: string;
  chatId: string;
  cursor?: string;
  limit?: number;
}

export async function getMessage({
  userId,
  chatId,
  cursor,
  limit = 20,
}: GetChatMessagesInput) {
  const chat = await prisma.chat.findFirst({
    where: {
      chatId,
      userId,
    },
  });

  if (!chat) {
    throw new Error("Chat not found");
  }

  const messages = await prisma.message.findMany({
    where: {
      chatId: chat.chatId,
    },
    orderBy: [
      {
        createdAt: "desc",
      },
      {
        messageId: "desc",
      },
    ],
    take: limit + 1,
    ...(cursor
      ? {
          cursor: {
            messageId: cursor,
          },
          skip: 1,
        }
      : {}),
  });

  const hasMore = messages.length > limit;

  if (hasMore) {
    messages.pop();
  }

  const nextCursor =
    hasMore && messages.length > 0
      ? messages[messages.length - 1].messageId
      : null;

  messages.reverse();

  return {
    messages,
    nextCursor,
    hasMore,
  };
}

export async function getRecentChatsService(
  userId: string
) {
  const chats = await prisma.chat.findMany({
    where: {
      userId,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      chatId: true,
      title: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return chats;
}

export async function searchChatServices(
  userId:string,
  query:string,
) {
  return prisma.chat.findMany({
    where:{
      userId,
      title:{
        contains:query,
        mode:"insensitive",
      }
    },
    orderBy:{
      updatedAt:"desc",
    },
    select: {
      chatId: true,
      title: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}
interface DeleteChatInput {
  userId: string;
  chatId: string;
}

export async function deleteChatService({
  userId,
  chatId,
}: DeleteChatInput) {
  const chat = await prisma.chat.findFirst({
    where: {
      chatId,
      userId,
    },
  });

  if (!chat) {
    throw new Error("Chat not found");
  }

  await prisma.$transaction([
    prisma.message.deleteMany({ where: { chatId: chat.chatId } }),
    prisma.chat.delete({ where: { chatId: chat.chatId } }),
  ]);

  return true;
}