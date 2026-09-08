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
        
        console.log(`Registering camera: ${name} -> ${streamUrl}`);
        
        const backendRes = await fetch("http://localhost:8080/api/cameras", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: name,
                streamUrl: streamUrl,
                location: "Warehouse CCTV"
            })
        });

        if (backendRes.ok) {
            console.log(`Successfully registered camera ${name}.`);
        } else {
            const errText = await backendRes.text();
            console.error(`Failed to register camera ${name}: ${backendRes.status} ${errText}`);
        }
    }
    
    console.log("Done registering all videos.");
}

main().catch(console.error);
