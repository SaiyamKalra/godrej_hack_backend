import { Request, Response } from "express";

const INFERENCE_SERVICE_URL = process.env.INFERENCE_SERVICE_URL || "http://localhost:8000";

export const streamCamera = async (req: Request, res: Response) => {
  const { cameraId } = req.params;
  const streamUrl = `${INFERENCE_SERVICE_URL}/stream/${cameraId}`;
  
  try {
    const response = await fetch(streamUrl);
    
    if (!response.ok) {
      res.status(response.status).send(`Failed to fetch stream: ${response.statusText}`);
      return;
    }

    res.setHeader("Content-Type", "multipart/x-mixed-replace; boundary=frame");
    
    // Pipe the response body to the express response
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } else {
      res.status(500).send("No response body");
    }
  } catch (error: any) {
    console.error(`Error streaming camera ${cameraId}:`, error);
    res.status(500).send("Streaming error");
  }
};

export const snapshotCamera = async (req: Request, res: Response) => {
  const { cameraId } = req.params;
  const snapshotUrl = `${INFERENCE_SERVICE_URL}/snapshot/${cameraId}`;
  
  try {
    const response = await fetch(snapshotUrl);
    
    if (!response.ok) {
      res.status(response.status).send(`Failed to fetch snapshot: ${response.statusText}`);
      return;
    }

    res.setHeader("Content-Type", "image/jpeg");
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (error: any) {
    console.error(`Error fetching snapshot for camera ${cameraId}:`, error);
    res.status(500).send("Snapshot error");
  }
};
