import prisma from "../db/prisma.js";

export const createAlertFromWebhook = async (data: any) => {
  const cameraId = data.cameraId || data.camera_id;
  const className = data.className || data.class_name;
  const confidence = data.confidence;
  const severity = data.severity;
  const bbox = data.bbox;
  const imageWidth = data.imageWidth || data.image_width;
  const imageHeight = data.imageHeight || data.image_height;
  const thumbnailUrl = data.thumbnailUrl || data.thumbnail_path;
  const clipPath = data.clipPath || data.clip_path;
  const clipDuration = data.clipDuration || data.clip_duration;
  const clipSize = data.clipSize || data.clip_size;
  
  return prisma.alert.create({
    data: {
      cameraId,
      className,
      confidence,
      severity: severity || "MEDIUM",
      bboxX1: bbox.x1,
      bboxY1: bbox.y1,
      bboxX2: bbox.x2,
      bboxY2: bbox.y2,
      imageWidth,
      imageHeight,
      thumbnailUrl,
      archiveClip: clipPath ? {
        create: {
          videoPath: clipPath,
          duration: clipDuration || 3.0,
          fileSize: clipSize || 0,
        }
      } : undefined,
    },
    include: {
      archiveClip: true,
    }
  });
};

export const getAlerts = async (filters: any) => {
  const { cameraId, className, severity, acknowledged, startDate, endDate, skip, take } = filters;
  
  const where: any = {};
  if (cameraId) where.cameraId = cameraId;
  if (className) where.className = className;
  if (severity) where.severity = severity;
  if (acknowledged !== undefined) where.acknowledged = acknowledged === 'true';
  
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [alerts, total] = await Promise.all([
    prisma.alert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: skip ? parseInt(skip) : 0,
      take: take ? parseInt(take) : 50,
      include: {
        camera: true,
        archiveClip: true
      }
    }),
    prisma.alert.count({ where })
  ]);
  
  return { alerts, total };
};

export const getAlertById = async (id: string) => {
  return prisma.alert.findUnique({
    where: { id },
    include: {
      camera: true,
      archiveClip: true,
    },
  });
};

export const acknowledgeAlert = async (id: string) => {
  return prisma.alert.update({
    where: { id },
    data: { acknowledged: true },
  });
};

export const getAlertStats = async () => {
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
};
