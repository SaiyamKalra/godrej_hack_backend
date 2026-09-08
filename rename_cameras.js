import { PrismaClient } from './src/generated/prisma/client.js';
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
    const cameras = await prisma.camera.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
    
    for (let i = 0; i < cameras.length; i++) {
        const newName = `CAM00${i+1}`.slice(-6); // CAM001, CAM002 etc.
        console.log(`Renaming ${cameras[i].name} to ${newName}`);
        await prisma.camera.update({
            where: { id: cameras[i].id },
            data: { name: newName }
        });
    }
    console.log("Done");
}

main().catch(console.error).finally(() => prisma.$disconnect());
