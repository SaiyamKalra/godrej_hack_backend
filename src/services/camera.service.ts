import prisma from "../db/prisma.js";

export const createCamera = async (name: string, streamUrl: string, location?: string) => {
  return prisma.camera.create({
    data: { name, streamUrl, location },
  });
};

export const getCameras = async () => {
  return prisma.camera.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
};

export const getCameraById = async (id: string) => {
  return prisma.camera.findUnique({
    where: { id },
  });
};

export const updateCamera = async (id: string, data: { name?: string; streamUrl?: string; location?: string; isActive?: boolean }) => {
  return prisma.camera.update({
    where: { id },
    data,
  });
};

export const deleteCamera = async (id: string) => {
  const camera = await getCameraById(id);
  if (camera) {
    return prisma.camera.update({
      where: { id },
      data: { 
        isActive: false,
        name: camera.name.endsWith(' (Deleted)') ? camera.name : `${camera.name} (Deleted)`
      },
    });
  }
};
