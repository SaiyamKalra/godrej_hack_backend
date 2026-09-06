import prisma from "../db/prisma.js";

export const getRecentAlertsTool = async (args: any) => {
  const take = args.limit ? parseInt(args.limit) : 10;
  const where: any = {};
  if (args.cameraId) where.cameraId = args.cameraId;
  if (args.className) where.className = args.className;
  if (args.severity) where.severity = args.severity;

  try {
    const alerts = await prisma.alert.findMany({
      where,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        camera: { select: { name: true, location: true } }
      }
    });
    return alerts;
  } catch (error: any) {
    console.error("Tool get_recent_alerts failed:", error);
    return { error: error.message };
  }
};

export const getAlertStatsTool = async () => {
  try {
    const [bySeverity, byClass, totalUnacknowledged] = await Promise.all([
      prisma.alert.groupBy({
        by: ['severity'],
        _count: { id: true }
      }),
      prisma.alert.groupBy({
        by: ['className'],
        _count: { id: true }
      }),
      prisma.alert.count({
        where: { acknowledged: false }
      })
    ]);
    return { bySeverity, byClass, totalUnacknowledged };
  } catch (error: any) {
    console.error("Tool get_alert_stats failed:", error);
    return { error: error.message };
  }
};

export const getCamerasTool = async () => {
  try {
    const cameras = await prisma.camera.findMany({
      orderBy: { createdAt: "desc" }
    });
    return cameras;
  } catch (error: any) {
    console.error("Tool get_cameras failed:", error);
    return { error: error.message };
  }
};

export const getArchiveClipsTool = async (args: any) => {
  const take = args.limit ? parseInt(args.limit) : 5;
  try {
    const clips = await prisma.archiveClip.findMany({
      take,
      orderBy: { createdAt: "desc" },
      include: {
        alert: {
          select: { className: true, severity: true, camera: { select: { name: true } } }
        }
      }
    });
    return clips;
  } catch (error: any) {
    console.error("Tool get_archive_clips failed:", error);
    return { error: error.message };
  }
};
