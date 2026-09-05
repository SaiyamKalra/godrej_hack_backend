import prisma from "../db/prisma.js";

import { generateChatTitle } from "./ollama.service.js";
import { runOllamaAgent } from "./ollama-agent.service.js";

import {
  addMessagetoCache,
  getMessageFromCache,
  setChatTitle,
  getChatTitle,
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
  let chat;

  /*
   * Existing chat
   */
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
  }

  /*
   * New chat
   */
  else {
    const initialTitle = await generateChatTitle(message);

    chat = await prisma.chat.create({
      data: {
        userId,
        title:
          initialTitle && initialTitle.trim().length > 0
            ? initialTitle
            : getInitialChatTitle(),
      },
    });
  }

  /*
   * Keep chat title in Redis
   */
  await setChatTitle(userId, chat.chatId, chat.title);

  /*
   * Get recent messages from Redis.
   *
   * Redis stores only the latest messages for fast access.
   */
  let previousMessages = await getMessageFromCache(chat.chatId);

  /*
   * Cache miss:
   * Load recent messages from PostgreSQL and rebuild Redis cache.
   */
  if (previousMessages.length === 0) {
    const dbMessages = await prisma.message.findMany({
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
      take: 10,
    });

    dbMessages.reverse();

    for (const dbMessage of dbMessages) {
      await addMessagetoCache(chat.chatId, {
        messageId: dbMessage.messageId,
        role: dbMessage.role,
        content: dbMessage.content,
        createdAt: dbMessage.createdAt,
      });
    }

    previousMessages = await getMessageFromCache(chat.chatId);
  }

  /*
   * Save user message to PostgreSQL
   */
  const userMessage = await prisma.message.create({
    data: {
      chatId: chat.chatId,
      role: "USER",
      content: message,
    },
  });

  /*
   * Save user message to Redis
   */
  await addMessagetoCache(chat.chatId, {
    messageId: userMessage.messageId,
    role: userMessage.role,
    content: userMessage.content,
    createdAt: userMessage.createdAt,
  });

  /*
   * Index user message in Elasticsearch
   */
  await indexMessage({
    messageId: userMessage.messageId,
    chatId: chat.chatId,
    userId,
    title: chat.title,
    role: userMessage.role,
    content: userMessage.content,
    createdAt: userMessage.createdAt,
  });

  /*
   * Get latest conversation from Redis
   *
   * This includes the newly added user message.
   */
  previousMessages = await getMessageFromCache(chat.chatId);

  /*
   * Convert messages to Ollama format
   */
  const ollamaMessages = previousMessages.map((msg) => ({
    role:
      msg.role === "USER"
        ? ("user" as const)
        : ("assistant" as const),
    content: msg.content,
  }));

  /*
   * Run Ollama agent
   */
  const assistantResponse = await runOllamaAgent(
    userId,
    ollamaMessages,
    onChunk
  );

  /*
   * Save assistant response to PostgreSQL
   */
  const assistantMessage = await prisma.message.create({
    data: {
      chatId: chat.chatId,
      role: "ASSISTANT",
      content: assistantResponse,
    },
  });

  /*
   * Save assistant response to Redis
   */
  await addMessagetoCache(chat.chatId, {
    messageId: assistantMessage.messageId,
    role: assistantMessage.role,
    content: assistantMessage.content,
    createdAt: assistantMessage.createdAt,
  });

  /*
   * Index assistant response in Elasticsearch
   */
  await indexMessage({
    messageId: assistantMessage.messageId,
    chatId: chat.chatId,
    userId,
    title: chat.title,
    role: assistantMessage.role,
    content: assistantMessage.content,
    createdAt: assistantMessage.createdAt,
  });

  /*
   * Update chat's last activity time
   */
  await prisma.chat.update({
    where: {
      chatId: chat.chatId,
    },
    data: {
      updatedAt: new Date(),
    },
  });

  /*
   * Generate a better title asynchronously
   *
   * We don't make the user wait for title generation.
   */
  const totalMessagesCount = await prisma.message.count({
    where: {
      chatId: chat.chatId,
    },
  });

  if (
    totalMessagesCount > 3 &&
    chat.title.startsWith("Chat on ")
  ) {
    const targetChatId = chat.chatId;

    const conversationSnippet = [
      ...previousMessages,
      {
        role: "ASSISTANT",
        content: assistantResponse,
      },
    ]
      .slice(0, 4)
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");

    generateChatTitle(conversationSnippet)
      .then(async (newTitle) => {
        if (
          newTitle &&
          newTitle.trim().length > 0 &&
          !newTitle.startsWith("Chat on ")
        ) {
          await prisma.chat.update({
            where: {
              chatId: targetChatId,
            },
            data: {
              title: newTitle,
            },
          });

          /*
           * Keep the new title synchronized with Redis.
           */
          await setChatTitle(
            userId,
            targetChatId,
            newTitle
          );
        }
      })
      .catch((err) => {
        console.error(
          "Failed to asynchronously generate chat title:",
          err
        );
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


/*
 * ============================================================
 * MESSAGE PAGINATION
 * ============================================================
 */

interface MessageCursor {
  createdAt: string;
  messageId: string;
}

interface GetChatMessagesInput {
  userId: string;
  chatId: string;
  cursor?: MessageCursor;
  limit?: number;
}

export async function getMessage({
  userId,
  chatId,
  cursor,
  limit = 20,
}: GetChatMessagesInput) {
  /*
   * Verify that the chat belongs to the authenticated user.
   */
  const chat = await prisma.chat.findFirst({
    where: {
      chatId,
      userId,
    },
  });

  if (!chat) {
    throw new Error("Chat not found");
  }

  /*
   * First request:
   *
   * Skip the latest 10 messages because they are already
   * available through Redis.
   */
  if (!cursor) {
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
      skip: 10,
      take: limit + 1,
    });

    const hasMore = messages.length > limit;

    if (hasMore) {
      messages.pop();
    }

    const lastMessage =
      messages.length > 0
        ? messages[messages.length - 1]
        : null;

    const nextCursor =
      hasMore && lastMessage
        ? {
            createdAt: lastMessage.createdAt.toISOString(),
            messageId: lastMessage.messageId,
          }
        : null;

    messages.reverse();

    return {
      messages,
      nextCursor,
      hasMore,
    };
  }

  /*
   * Subsequent requests:
   *
   * Fetch messages older than the cursor.
   */
  const messages = await prisma.message.findMany({
    where: {
      chatId,

      OR: [
        {
          createdAt: {
            lt: new Date(cursor.createdAt),
          },
        },
        {
          createdAt: new Date(cursor.createdAt),
          messageId: {
            lt: cursor.messageId,
          },
        },
      ],
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
  });

  const hasMore = messages.length > limit;

  if (hasMore) {
    messages.pop();
  }

  const lastMessage =
    messages.length > 0
      ? messages[messages.length - 1]
      : null;

  const nextCursor =
    hasMore && lastMessage
      ? {
          createdAt: lastMessage.createdAt.toISOString(),
          messageId: lastMessage.messageId,
        }
      : null;

  messages.reverse();

  return {
    messages,
    nextCursor,
    hasMore,
  };
}


/*
 * ============================================================
 * RECENT CHAT PAGINATION
 * ============================================================
 */

interface ChatCursor {
  updatedAt: string;
  chatId: string;
}

interface GetRecentChatsInput {
  userId: string;
  cursor?: ChatCursor;
  limit?: number;
}

export async function getRecentChatsService({
  userId,
  cursor,
  limit = 30,
}: GetRecentChatsInput) {
  /*
   * First request:
   * Try Redis first.
   */
  if (!cursor) {
    const cachedChats = await getChatTitle(userId);

    if (cachedChats.length > 0) {
      return {
        chats: cachedChats,
        nextCursor: null,
        hasMore: false,
      };
    }

    /*
     * Redis cache miss:
     * Load chats from PostgreSQL.
     */
    const chats = await prisma.chat.findMany({
      where: {
        userId,
      },

      orderBy: [
        {
          updatedAt: "desc",
        },
        {
          chatId: "desc",
        },
      ],

      take: limit + 1,

      select: {
        chatId: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const hasMore = chats.length > limit;

    if (hasMore) {
      chats.pop();
    }

    /*
     * Rebuild Redis cache.
     */
    for (const chat of chats) {
      await setChatTitle(
        userId,
        chat.chatId,
        chat.title
      );
    }

    const lastChat =
      chats.length > 0
        ? chats[chats.length - 1]
        : null;

    const nextCursor =
      hasMore && lastChat
        ? {
            updatedAt: lastChat.updatedAt.toISOString(),
            chatId: lastChat.chatId,
          }
        : null;

    return {
      chats,
      nextCursor,
      hasMore,
    };
  }

  /*
   * Subsequent requests:
   * Fetch chats older than cursor.
   */
  const chats = await prisma.chat.findMany({
    where: {
      userId,

      OR: [
        {
          updatedAt: {
            lt: new Date(cursor.updatedAt),
          },
        },
        {
          updatedAt: new Date(cursor.updatedAt),
          chatId: {
            lt: cursor.chatId,
          },
        },
      ],
    },

    orderBy: [
      {
        updatedAt: "desc",
      },
      {
        chatId: "desc",
      },
    ],

    take: limit + 1,

    select: {
      chatId: true,
      title: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const hasMore = chats.length > limit;

  if (hasMore) {
    chats.pop();
  }

  const lastChat =
    chats.length > 0
      ? chats[chats.length - 1]
      : null;

  const nextCursor =
    hasMore && lastChat
      ? {
          updatedAt: lastChat.updatedAt.toISOString(),
          chatId: lastChat.chatId,
        }
      : null;

  return {
    chats,
    nextCursor,
    hasMore,
  };
}


/*
 * ============================================================
 * CHAT SEARCH
 * ============================================================
 */

export async function searchChatServices(
  userId: string,
  query: string
) {
  /*
   * Elasticsearch searches both:
   * - chat title
   * - message content
   */
  return searchMessages(userId, query);
}


/*
 * ============================================================
 * DELETE CHAT
 * ============================================================
 */

interface DeleteChatInput {
  userId: string;
  chatId: string;
}

export async function deleteChatService({
  userId,
  chatId,
}: DeleteChatInput) {
  /*
   * Verify ownership.
   */
  const chat = await prisma.chat.findFirst({
    where: {
      chatId,
      userId,
    },
  });

  if (!chat) {
    throw new Error("Chat not found");
  }

  /*
   * PostgreSQL:
   *
   * Delete messages first, then chat.
   */
  await prisma.$transaction([
    prisma.message.deleteMany({
      where: {
        chatId: chat.chatId,
      },
    }),

    prisma.chat.delete({
      where: {
        chatId: chat.chatId,
      },
    }),
  ]);

  /*
   * Redis:
   * Remove cached messages and chat title.
   */
  await deleteChatFromCache(
    userId,
    chatId
  );

  /*
   * Elasticsearch:
   * Remove all indexed messages belonging to this chat.
   */
  await deleteMessagesByChat(
    chatId,
    userId
  );

  return true;
}