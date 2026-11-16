import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | undefined;

export function isDatabaseConfigured(): boolean {
  const url = import.meta.env.DATABASE_URL;
  return Boolean(url && !url.includes('REPLACE_ME') && !url.includes('[YOUR-PASSWORD]'));
}

export function getPrisma(): PrismaClient {
  const url = import.meta.env.DATABASE_URL;

  if (!url || !isDatabaseConfigured()) {
    throw new Error(
      'Database is not configured. Set DATABASE_URL in .env.local with your Supabase database password.',
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
