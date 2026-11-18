import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const problems = [];

try {
  const roles = await prisma.$queryRawUnsafe(
    "select rolcanlogin, rolbypassrls, rolsuper from pg_roles where rolname = 'tosder_runtime'",
  );
  if (roles.length !== 1) {
    problems.push('tosder_runtime role is missing.');
  } else {
    const role = roles[0];
    if (!role.rolcanlogin) problems.push('tosder_runtime cannot log in.');
    if (!role.rolbypassrls) problems.push('tosder_runtime does not bypass RLS for the current app context.');
    if (role.rolsuper) problems.push('tosder_runtime must not be a superuser.');
  }

  const [ddl] = await prisma.$queryRawUnsafe(
    "select has_schema_privilege('tosder_runtime', 'public', 'CREATE') as can_create",
  );
  if (ddl.can_create) problems.push('tosder_runtime can create schema objects.');

  const [read] = await prisma.$queryRawUnsafe(
    "select has_table_privilege('tosder_runtime', 'travel_templates', 'SELECT') as can_read",
  );
  if (!read.can_read) problems.push('tosder_runtime cannot read travel_templates.');

  const [write] = await prisma.$queryRawUnsafe(
    "select has_table_privilege('tosder_runtime', 'user_trips', 'INSERT') as can_write",
  );
  if (!write.can_write) problems.push('tosder_runtime cannot write user_trips.');
} finally {
  await prisma.$disconnect();
}

if (problems.length > 0) {
  console.error('Runtime role checks failed:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log('Runtime role checks passed');
}
