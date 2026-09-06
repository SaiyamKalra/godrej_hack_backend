import { Request, Response } from "express";
import fs from "fs";
import prisma from "../db/prisma.js";

export const getArchiveClips = async (req: Request, res: Response) => {
  try {
    const { skip, take, cameraId } = req.query;
    
    const where: any = {};
    if (cameraId) {
      where.alert = { cameraId };
    }

    const [clips, total] = await Promise.all([
      prisma.archiveClip.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: skip ? parseInt(skip as string) : 0,
        take: take ? parseInt(take as string) : 20,
        include: {
          alert: {
            include: {
              camera: true
            }
          }
        }
      }),
      prisma.archiveClip.count({ where })
    ]);
    
    res.json({ clips, total, status: 1 });
  } catch (error: any) {
    res.status(500).json({ error: error.message, status: 0 });
  }
};

export const getArchiveClipById = async (req: Request, res: Response) => {
  try {
    const clip = await prisma.archiveClip.findUnique({
      where: { id: req.params.id as string },
      include: {
        alert: {
          include: {
            camera: true
          }
        }
      }
    });
    
    if (!clip) {
      res.status(404).json({ error: "Clip not found", status: 0 });
      return;
    }
    
    res.json({ clip, status: 1 });
  } catch (error: any) {
    res.status(500).json({ error: error.message, status: 0 });
  }
};

export const streamVideo = async (req: Request, res: Response) => {
  try {
    const clip = await prisma.archiveClip.findUnique({
      where: { id: req.params.id as string }
    });
    
    if (!clip) {
      res.status(404).send("Clip not found");
      return;
    }

    const videoPath = clip.videoPath;
    if (!fs.existsSync(videoPath)) {
      res.status(404).send("Video file not found on disk");
      return;
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (error: any) {
    console.error("Video stream error:", error);
    res.status(500).send("Error streaming video");
  }
};
