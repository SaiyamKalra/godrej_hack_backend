import redisClient from "./redis.js";

interface CachedMessage {
  messageId: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: Date;
}

export async function addMessagetoCache(chatId: string, message: CachedMessage) {
  try {
    if (!redisClient.isOpen) return;
    const key = `chat:${chatId}:messages`;
    await redisClient.multi().lPush(key, JSON.stringify(message)).lTrim(key, 0, 9).exec();
  } catch (err) {
    console.warn("Redis addMessagetoCache error:", err);
  }
}

export async function getMessageFromCache(chatId: string): Promise<CachedMessage[]> {
  try {
    if (!redisClient.isOpen) return [];
    const key = `chat:${chatId}:messages`;
    const messages = await redisClient.lRange(key, 0, 9);
    return messages.map((message) => JSON.parse(message)).reverse();
  } catch (err) {
    console.warn("Redis getMessageFromCache error:", err);
    return [];
  }
}

export async function setChatTitle(userId: string, chatId: string, title: string) {
  try {
    if (!redisClient.isOpen) return;
    const key = `chat:${userId}:titles`;
    const chats = await redisClient.lRange(key, 0, 29);
    for (const item of chats) {
      try {
        const parsed = JSON.parse(item);
        if (parsed.chatId === chatId) {
          await redisClient.lRem(key, 0, item);
        }
      } catch {}
    }

    await redisClient
      .multi()
      .lPush(key, JSON.stringify({ chatId, title }))
      .lTrim(key, 0, 29)
      .exec();
  } catch (err) {
    console.warn("Redis setChatTitle error:", err);
  }
}

export async function getChatTitle(userId: string): Promise<{ chatId: string; title: string }[]> {
  try {
    if (!redisClient.isOpen) return [];
    const key = `chat:${userId}:titles`;
    const recentTitle = await redisClient.lRange(key, 0, 29);
    return recentTitle.map((title) => JSON.parse(title));
  } catch (err) {
    console.warn("Redis getChatTitle error:", err);
    return [];
  }
}

export async function deleteChatFromCache(userId: string, chatId: string) {
  try {
    if (!redisClient.isOpen) return;
    const key1 = `chat:${chatId}:messages`;
    await redisClient.del(key1);
    const key2 = `chat:${userId}:titles`;
    const chats = await redisClient.lRange(key2, 0, 29);

    for (const chat of chats) {
      try {
        const parsed = JSON.parse(chat);
        if (parsed.chatId === chatId) {
          await redisClient.lRem(key2, 0, chat);
          break;
        }
      } catch {}
    }
  } catch (err) {
    console.warn("Redis deleteChatFromCache error:", err);
  }
}