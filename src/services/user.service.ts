import prisma from "../db/prisma";

export async function syncFirebaseUser(
  userId: string,
  email: string,
  name: string
) {
  return prisma.user.upsert({
    where: {
      userId,
    },

    update: {
      email,
      name,
    },

    create: {
      userId,
      email,
      name,
    },
  });
}