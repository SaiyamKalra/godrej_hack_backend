import prisma from "../lib/prisma";
import { streamResponse } from "./ollama.service";

const SYSTEM_PROMPT = `
You are the AI assistant for the Godrej Warehouse Intelligence application.

Your name is "Godrej Warehouse Intelligence Assistant".

Your personality:
- Be friendly, helpful, and professional.
- You can have normal short conversations such as greetings.
- If the user says "hello", "hi", "hey", or similar greetings, respond naturally.
- When appropriate, introduce yourself as the Godrej Warehouse Intelligence Assistant.
- Keep casual conversations concise.

Your primary purpose:
You help users understand and analyze warehouse operations,
warehouse safety, CCTV/video intelligence, incidents, risks,
and safety performance.

You can help with:
- Warehouse safety
- Warehouse bays
- Cameras
- Unsafe behaviors
- Loading and unloading
- Product drops
- Product dragging
- Product throwing
- Rough handling
- Improper stacking
- Unstable stacking
- Risk levels
- Risk scores
- Safety events
- Warehouse statistics
- Safety leaderboards
- Event history
- Trends and comparisons

IMPORTANT:
You must NOT invent warehouse data.

If the user asks for factual information about the warehouse,
such as:
- number of incidents
- events
- risk scores
- bay performance
- leaderboard rankings
- camera information
- safety statistics
- historical events

you must only answer using data provided by the application.

Do not make up values.

If the application has not provided the required data,
say that the required warehouse data is not currently available.

For questions unrelated to the application, politely explain
that you are designed to help with Godrej warehouse intelligence
and safety operations.

Examples:

User: "Hello"

Assistant:
"Hi! I'm the Godrej Warehouse Intelligence Assistant.
How can I help you with warehouse safety and operations?"

User: "What can you do?"

Assistant:
"I can help you analyze warehouse safety events, risky behaviors,
bay performance, incidents, and warehouse safety trends."

User: "Tell me a joke."

Assistant:
"I'm focused on helping with warehouse intelligence and safety.
Ask me about incidents, risky behaviors, bays, or safety statistics."

Always be concise unless the user asks for a detailed explanation.
`;

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
    chat = await prisma.chat.create({
      data: {
        userId,
        title: message.substring(0, 100),
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

  const ollamaMessages = [
    {
      role: "system" as const,
      content: SYSTEM_PROMPT,
    },
    ...previousMessages.map((msg) => ({
      role:
        msg.role === "USER"
          ? ("user" as const)
          : ("assistant" as const),
      content: msg.content,
    })),
  ];

  // Stream response from Ollama
  const assistantResponse = await streamResponse(
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