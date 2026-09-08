import { PrismaClient } from './src/generated/prisma/client.js';
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "@elastic/elasticsearch";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const elasticsearch = new Client({
    node: process.env.ELASTIC_SEARCH_URL || "http://localhost:9200",
});

async function main() {
    console.log("Recreating Elasticsearch index...");
    try {
        await elasticsearch.indices.delete({ index: "messages" });
    } catch(e) {}
    
    await elasticsearch.indices.create({
        index: "messages",
        mappings: {
          properties: {
            messageId: { type: "keyword" },
            chatId: { type: "keyword" },
            userId: { type: "keyword" },
            title: { type: "text" },
            role: { type: "keyword" },
            content: { type: "text" },
            createdAt: { type: "date" },
          },
        },
    });

    console.log("Fetching all messages...");
    const messages = await prisma.message.findMany({
        include: {
            chat: true
        }
    });

    console.log(`Indexing ${messages.length} messages...`);
    for (const msg of messages) {
        if (!msg.chat) continue;
        await elasticsearch.index({
            index: "messages",
            id: msg.messageId,
            document: {
                messageId: msg.messageId,
                chatId: msg.chatId,
                userId: msg.chat.userId,
                title: msg.chat.title,
                role: msg.role,
                content: msg.content,
                createdAt: msg.createdAt,
            }
        });
    }
    
    console.log("Done!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
