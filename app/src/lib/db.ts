// Client Prisma partagé, en singleton pour éviter d'ouvrir une nouvelle
// connexion à chaque hot-reload en développement.

import { PrismaClient } from "@prisma/client";

const globalPourPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalPourPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalPourPrisma.prisma = db;
