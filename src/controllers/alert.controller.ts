import { Request, Response } from "express";
import * as alertService from "../services/alert.service.js";

export const createAlertFromWebhook = async (req: Request, res: Response) => {
  try {
    const alert = await alertService.createAlertFromWebhook(req.body);
    res.json({ alert, status: 1 });
  } catch (error: any) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: error.message, status: 0 });
  }
};

export const getAlerts = async (req: Request, res: Response) => {
  try {
    const data = await alertService.getAlerts(req.query);
    res.json({ ...data, status: 1 });
  } catch (error: any) {
    res.status(500).json({ error: error.message, status: 0 });
  }
};

export const getAlertStats = async (req: Request, res: Response) => {
  try {
    const stats = await alertService.getAlertStats();
    res.json({ stats, status: 1 });
  } catch (error: any) {
    res.status(500).json({ error: error.message, status: 0 });
  }
};

export const getAlertById = async (req: Request, res: Response) => {
  try {
    const alert = await alertService.getAlertById(req.params.id as string);
    if (!alert) {
      res.status(404).json({ error: "Alert not found", status: 0 });
      return;
    }
    res.json({ alert, status: 1 });
  } catch (error: any) {
    res.status(500).json({ error: error.message, status: 0 });
  }
};

export const acknowledgeAlert = async (req: Request, res: Response) => {
  try {
    const alert = await alertService.acknowledgeAlert(req.params.id as string);
    res.json({ alert, status: 1 });
  } catch (error: any) {
    res.status(500).json({ error: error.message, status: 0 });
  }
};
