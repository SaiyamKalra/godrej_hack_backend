import { Request, Response } from "express";
import * as cameraService from "../services/camera.service.js";

export const createCamera = async (req: Request, res: Response) => {
  try {
    const { name, streamUrl, location } = req.body;
    if (!name || !streamUrl) {
      res.status(400).json({ error: "Missing required fields", status: 0 });
      return;
    }
    const camera = await cameraService.createCamera(name, streamUrl, location);
    res.json({ camera, status: 1 });
  } catch (error: any) {
    res.status(500).json({ error: error.message, status: 0 });
  }
};

export const getCameras = async (req: Request, res: Response) => {
  try {
    const cameras = await cameraService.getCameras();
    res.json({ cameras, status: 1 });
  } catch (error: any) {
    res.status(500).json({ error: error.message, status: 0 });
  }
};

export const getCameraById = async (req: Request, res: Response) => {
  try {
    const camera = await cameraService.getCameraById(req.params.id as string);
    if (!camera) {
      res.status(404).json({ error: "Camera not found", status: 0 });
      return;
    }
    res.json({ camera, status: 1 });
  } catch (error: any) {
    res.status(500).json({ error: error.message, status: 0 });
  }
};

export const updateCamera = async (req: Request, res: Response) => {
  try {
    const camera = await cameraService.updateCamera(req.params.id as string, req.body);
    res.json({ camera, status: 1 });
  } catch (error: any) {
    res.status(500).json({ error: error.message, status: 0 });
  }
};

export const deleteCamera = async (req: Request, res: Response) => {
  try {
    await cameraService.deleteCamera(req.params.id as string);
    res.json({ message: "Camera deleted", status: 1 });
  } catch (error: any) {
    res.status(500).json({ error: error.message, status: 0 });
  }
};
