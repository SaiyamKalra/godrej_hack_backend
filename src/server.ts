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