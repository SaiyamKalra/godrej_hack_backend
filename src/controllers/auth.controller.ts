import { Request, Response } from "express";
import { syncFirebaseUser } from "../services/user.service.js";

export async function syncUser(req: Request, res: Response) {
  try {
    const user = req.user!;

    const userId = user.uid;
    const email = user.email;

    if (!email) {
      return res.status(400).json({
        error: "Email not found in Firebase token",
        status: 0,
      });
    }

    const name = user.name ?? "User";

    const dbUser = await syncFirebaseUser(
      userId,
      email,
      name
    );

    return res.status(200).json({
      message: "User synced successfully",
      user: dbUser,
      status: 1,
    });
  } catch (error) {
    console.error("Error syncing user:", error);

    return res.status(500).json({
      error: "Failed to sync user",
      status: 0,
    });
  }
}   