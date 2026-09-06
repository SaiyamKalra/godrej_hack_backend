import {createClient} from "redis";

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
  socket: {
    reconnectStrategy: (retries) => {
      if (retries >= 1) {
        return false;
      }
      return 100;
    },
  },
});

redisClient.on("error", (error) => {
  // Suppress uncaught reconnect error spam when Redis is offline
});

export async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}

export default redisClient;