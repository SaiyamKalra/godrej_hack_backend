import prisma from "../db/prisma.js";
import { generateChatTitle } from "./ollama.service.js";
import { runOllamaAgent } from "./ollama-agent.service.js";
import {
  addMessagetoCache,
  setChatTitle,
  deleteChatFromCache,
} from "../cache/chat.cache.js";
import {
  indexMessage,
  searchMessages,
  deleteMessagesByChat,
} from "../search/message.search.js";

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

  // Update Redis chat title safely in background if available
  setChatTitle(userId, chat.chatId, chat.title).catch(() => {});

  const userMessage = await prisma.message.create({
    data: {
      chatId: chat.chatId,
      role: "USER",
      content: message,
    },
  });

  // Sync user message to cache and search asynchronously
  addMessagetoCache(chat.chatId, {
    messageId: userMessage.messageId,
    role: userMessage.role,
    content: userMessage.content,
    createdAt: userMessage.createdAt,
  }).catch(() => {});

  indexMessage({
    messageId: userMessage.messageId,
    chatId: chat.chatId,
    userId,
    title: chat.title,
    role: userMessage.role,
    content: userMessage.content,
    createdAt: userMessage.createdAt,
  }).catch(() => {});

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

  // Sync assistant message to cache and search asynchronously
  addMessagetoCache(chat.chatId, {
    messageId: assistantMessage.messageId,
    role: assistantMessage.role,
    content: assistantMessage.content,
    createdAt: assistantMessage.createdAt,
  }).catch(() => {});

  indexMessage({
    messageId: assistantMessage.messageId,
    chatId: chat.chatId,
    userId,
    title: chat.title,
    role: assistantMessage.role,
    content: assistantMessage.content,
    createdAt: assistantMessage.createdAt,
  }).catch(() => {});

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
          setChatTitle(userId, targetChatId, newTitle).catch(() => {});
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
  cursor?: string | { messageId?: string; createdAt?: string };
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

  const cursorMessageId = typeof cursor === "string" ? cursor : cursor?.messageId;

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
    ...(cursorMessageId
      ? {
          cursor: {
            messageId: cursorMessageId,
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
  input: string | { userId: string; cursor?: any; limit?: number }
) {
  const userId = typeof input === "string" ? input : input.userId;

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
  userId: string,
  query: string
) {
  // Try Elasticsearch first for full-text fuzzy + prefix search
  if (process.env.ELASTIC_SEARCH_URL) {
    try {
      const esResults = await searchMessages(userId, query);

      if (esResults && esResults.length > 0) {
        // Extract unique chatIds from ES results (already collapsed by chatId)
        const chatIds = esResults
          .map((r: any) => r.chatId)
          .filter((id: string): id is string => !!id);

        if (chatIds.length > 0) {
          // Fetch full chat objects from DB for current title/timestamps
          const chats = await prisma.chat.findMany({
            where: {
              chatId: { in: chatIds },
              userId,
            },
            select: {
              chatId: true,
              title: true,
              createdAt: true,
              updatedAt: true,
            },
          });

          // Preserve ES relevance ordering
          const chatMap = new Map(chats.map((c) => [c.chatId, c]));
          return chatIds
            .map((id: string) => chatMap.get(id))
            .filter(Boolean);
        }
      }

      // ES returned no results — return empty rather than falling through
      // (this means the query genuinely matched nothing)
      return [];
    } catch (err) {
      console.warn("ES search failed, falling back to Prisma:", err);
    }
  }

  // Fallback: Prisma text search (no fuzzy, title only)
  return prisma.chat.findMany({
    where: {
      userId,
      title: {
        contains: query,
        mode: "insensitive",
      },
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

  // Clean up cache and search non-blockingly / safely
  deleteChatFromCache(userId, chatId).catch((err) => {
    console.warn("Failed to delete chat from cache:", err);
  });
  deleteMessagesByChat(chatId, userId).catch((err) => {
    console.warn("Failed to delete messages from elasticsearch:", err);
  });

  return true;
}