import { DATABASE_URL } from 'astro:env/server';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | undefined;

export function isDatabaseConfigured(): boolean {
  return Boolean(
    DATABASE_URL &&
      !DATABASE_URL.includes('REPLACE_ME') &&
      !DATABASE_URL.includes('[YOUR-PASSWORD]'),
  );
}

export function getPrisma(): PrismaClient {
  const url = DATABASE_URL;

  if (!url || !isDatabaseConfigured()) {
    throw new Error(
      'Database is not configured. Set DATABASE_URL in .env.local with your Neon connection string.',
    );
  }

  prisma ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });

  return prisma;
}

export async function checkDatabase(): Promise<{
  configured: boolean;
  reachable: boolean | null;
  message?: string;
}> {
  if (!isDatabaseConfigured()) {
    return {
      configured: false,
      reachable: null,
      message: 'DATABASE_URL is missing or still contains a placeholder.',
    };
  }

  try {
    await getPrisma().$queryRaw`SELECT 1`;
    return { configured: true, reachable: true };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      message: error instanceof Error ? error.message : 'Unknown database error.',
    };
  }
}
