import {createClient} from "redis";

const redisClient=createClient({
    url:process.env.REDIS_URL,
});

redisClient.on("error",(error)=>{
    console.error("A error occurred",error);
})

export async function connectRedis(){
    if(!redisClient.isOpen){
        await redisClient.connect();
    }
}

export default redisClient;