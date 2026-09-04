import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import serviceAccount from "../../warewatch2026-firebase-adminsdk-fbsvc-7c473a7aa5.json";

const firebaseApp = initializeApp({
  credential: cert(serviceAccount as any),
});

export const firebaseAuth = getAuth(firebaseApp);