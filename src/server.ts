import "dotenv/config";

import app from "./app.js";

import { connectRedis } from "./cache/redis.js";
import { createMessageIndex } from "./search/message.search.js";

const PORT = process.env.PORT || 8080;

async function startServer(){
  try{
    try {
      if (process.env.REDIS_URL) {
        await connectRedis();
        console.log("Connected to Redis");
      } else {
        console.log("REDIS_URL not configured, running without Redis");
      }
    } catch (redisErr: any) {
      console.warn("Failed to connect to Redis, continuing without Redis cache:", redisErr?.message || redisErr);
    }

    try {
      if (process.env.ELASTIC_SEARCH_URL) {
        await createMessageIndex();
        console.log("Elasticsearch message index verified");
      } else {
        console.log("ELASTIC_SEARCH_URL not configured, running without Elasticsearch");
      }
    } catch (esErr) {
      console.warn("Failed to initialize Elasticsearch, continuing without Elasticsearch:", esErr);
    }
    try {
      const { PrismaClient } = await import("./generated/prisma/client.js");
      const { PrismaPg } = await import("@prisma/adapter-pg");
      const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
      const prisma = new PrismaClient({ adapter });
      
      const cameras = await prisma.camera.findMany({ where: { isActive: true } });
      const INFERENCE_SERVICE_URL = process.env.INFERENCE_SERVICE_URL || "http://localhost:8000";
      console.log(`Syncing ${cameras.length} cameras to inference service...`);
      for (const camera of cameras) {
        try {
          const qs = new URLSearchParams({
            camera_id: camera.id,
            stream_url: camera.streamUrl,
            camera_name: camera.name
          }).toString();
          await fetch(`${INFERENCE_SERVICE_URL}/cameras?${qs}`, { method: 'POST' });
        } catch (err) {
          console.warn(`Failed to sync camera ${camera.name}:`, err);
        }
      }
      await prisma.$disconnect();
    } catch (syncErr) {
      console.warn("Failed to sync cameras with inference service on startup:", syncErr);
    }
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
  catch(err){
    console.error("failed to start server:",err);
    process.exit(1);
  }
}

startServer();