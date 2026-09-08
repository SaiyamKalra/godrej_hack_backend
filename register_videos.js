import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();
const INFERENCE_SERVICE_URL = "http://localhost:8000";

async function main() {
    console.log("Fetching video list from fake CCTV server...");
    const res = await fetch("http://127.0.0.1:5000/list");
    if (!res.ok) {
        throw new Error("Failed to fetch videos from http://127.0.0.1:5000/list");
    }
    const data = await res.json();
    const videos = data.videos;
    
    console.log(`Found ${videos.length} videos.`);

    for (const video of videos) {
        const name = video.name.replace('.mp4', '').replace('.avi', '').replace('.mkv', '');
        const streamUrl = `http://host.docker.internal:5000/stream/${video.id}`;
        
        console.log(`Registering camera: ${name}`);
        
        // Save to DB
        const camera = await prisma.camera.create({
            data: {
                name: name,
                streamUrl: streamUrl,
                location: 'Warehouse'
            }
        });
        
        // Register to Inference Service
        const qs = new URLSearchParams({
            camera_id: camera.id,
            stream_url: camera.streamUrl,
            camera_name: camera.name
        }).toString();
        
        try {
            const infRes = await fetch(`${INFERENCE_SERVICE_URL}/cameras?${qs}`, { method: 'POST' });
            if (infRes.ok) {
                console.log(`Successfully registered camera ${name} with inference service.`);
            } else {
                console.error(`Failed to register camera ${name} with inference service: ${infRes.statusText}`);
            }
        } catch (e) {
            console.error(`Failed to connect to inference service:`, e);
        }
    }
    
    console.log("Done registering all videos.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
