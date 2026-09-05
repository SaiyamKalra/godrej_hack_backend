import redisClient from "./redis.js";

interface CachedMessage {
  messageId: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: Date;
}

export async function addMessagetoCache(chatId:string,message:CachedMessage){
    const key=`chat:${chatId}:messages`;
    await redisClient.multi().lPush(key,JSON.stringify(message)).lTrim(key,0,9).exec();
}

export async function getMessageFromCache(chatId:string){
    const key=`chat:${chatId}:messages`;
    const messages=await redisClient.lRange(key,0,9);
    return messages.map((message)=>JSON.parse(message)).reverse();
}

export async function setChatTitle(userId:string,chatId:string,title:string){
    const key=`chat:${userId}:titles`;
    await redisClient.lRem(
    key,
    0,
    JSON.stringify({chatId,title})
  );

   await redisClient
    .multi()
    .lPush(key, JSON.stringify({chatId,title}))
    .lTrim(key, 0, 29)
    .exec();
}

export async function getChatTitle(userId:string){
    const key=`chat:${userId}:titles`;
    const recentTitle=await redisClient.lRange(key,0,29);
    return recentTitle.map((title)=>JSON.parse(title)); 
}

export async function deleteChatFromCache(userId:string,chatId:string){
    const key1=`chat:${chatId}:messages`;
    await redisClient.del(key1);
    const key2=`chat:${userId}:titles`;
    const chats = await redisClient.lRange(key2, 0, 29);

  for (const chat of chats) {
    const parsed = JSON.parse(chat);

    if (parsed.chatId === chatId) {
      await redisClient.lRem(key2, 0, chat);
      break;
    }
  }
}