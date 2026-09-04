import prisma from "../lib/prisma";

export interface DatabaseQuery{
    table:"user";
    operation:"findUnique"|"findMany"|"count";
    filters?:Record<string,unknown>;
};

export async function databaseTool(
    userId:string,
    query:DatabaseQuery,
){
    if(!userId){
        throw new Error("Authentication user id not found");
    }
    if(query.table=="user"){
        if(query.operation=="findUnique"){
            const user=await prisma.user.findUnique({
                where:{
                    userId,
                },
                select:{
                    email:true,
                    name:true,
                }
            })
            return user;
        }
        if(query.operation=="findMany"){
            const user=await prisma.user.findUnique({
                    where:{
                        userId,
                    },
                    select:{
                        email:true,
                        name:true,
                    }
                })
                return user;
        }
    
        if (query.operation === "count") {
          const user = await prisma.user.findUnique({
            where: {
              userId,
            },
    
            select: {
              userId: true,
            },
          });
    
          return user ? 1 : 0;
        }
    }
    throw new Error(
        "Requested database operation is not allowed"
    );
}

