import { Request, Response, NextFunction } from "express";
import { firebaseAuth } from "../config/firebase.js";

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authorization token is required",
        status: 0,
      });
    }

    const idToken = authHeader.substring(7);

    const decodedToken = await firebaseAuth.verifyIdToken(idToken);

    req.user = decodedToken;

    next();
  } catch (error) {
    console.error("Firebase authentication error:", error);

    return res.status(401).json({
      error: "Invalid or expired token",
      status: 0,
    });
  }
}