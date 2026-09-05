import "dotenv/config";

import app from "./app.js";

import { connectRedis } from "./cache/redis.js";
import { createMessageIndex } from "./search/message.search.js";

const PORT = process.env.PORT || 8080;

async function startServer(){
  try{
    await connectRedis();
    await createMessageIndex();
    
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