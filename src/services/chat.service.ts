import prisma from "../db/prisma.js";
import { generateChatTitle} from "./ollama.service.js";
import { runOllamaAgent } from "./ollama-agent.service.js";

interface SendMessageInput {
  userId: string;
  chatId?: string;
  message: string;
  onChunk?: (content: string) => void;
}

function getInitialChatTitle(date: Date = new Date()): string {
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `Chat on ${dateStr} at ${timeStr}`;
}

export async function sendMessage({
  userId,
  chatId,
  message,
  onChunk,
}: SendMessageInput) {
  const chat = chatId
    ? await prisma.chat.findFirst({
        where: {
          chatId,
          userId,
        },
      })
    : await prisma.chat.create({
        data: {
          userId,
          title: getInitialChatTitle(),
        },
      });

  if (!chat) {
    throw new Error("Chat not found");
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

  // When the chat has more than three messages and still has the initial default title, generate the title asynchronously
  const totalMessagesCount = await prisma.message.count({
    where: { chatId: chat.chatId },
  });

  if (totalMessagesCount > 3 && chat.title.startsWith("Chat on ")) {
    const targetChatId = chat.chatId;
    const conversationSnippet = [
      ...previousMessages,
      { role: "ASSISTANT", content: assistantResponse },
    ]
      .slice(0, 4)
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");

    generateChatTitle(conversationSnippet)
      .then(async (newTitle) => {
        if (newTitle && !newTitle.startsWith("Chat on ")) {
          await prisma.chat.update({
            where: { chatId: targetChatId },
            data: { title: newTitle },
          });
        }
      })
      .catch((err) => {
        console.error("Failed to asynchronously generate chat title:", err);
      });
  }

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