# Backup, restore, and migration rollback

## What Neon provides

- Continuous WAL history on the project branch.
- Point-in-time restore (PITR) within the project's history window.
- On-demand snapshots for a known-good release point.
- Branch creation from current data or a past timestamp/LSN.

Record the PITR window and the retention setting in the launch record. The
default window can be shorter than a production incident, so do not assume
seven days without checking.

## Release backup procedure

1. Before a production migration, record the current UTC time and, if the
   console exposes it, the branch LSN.
2. Create a snapshot named after the release commit, for example
   `release-16d47bf-20261118`.
3. Run the migration with the direct connection string:

   ```bash
   PRODUCTION_DATABASE_URL="postgresql://..." \
   PRODUCTION_DIRECT_URL="postgresql://..." \
   npm run db:production:migrate
   ```

4. Verify `npm run db:verify` against staging and `/api/health` against
   production.
5. Record the snapshot id, migration list, commit, and operator in the release
   issue.

## Restore options

### Restore a deleted or damaged branch

Use the Neon console or CLI to restore from a snapshot or a point in time.
Restoring creates or resets a branch; it is not an in-place undo of one table.
After restore, point the application at the restored branch and verify auth,
content, trips, usage ledger, competitions, rewards, and audit rows.

### Restore one table

Prefer a temporary branch from the target timestamp, copy the affected rows into
the production branch with a reviewed SQL transaction, and record the change in
the audit log. Do not run ad-hoc destructive SQL directly on production.

### Roll back an application release

Roll back the Vercel deployment to the previous known-good deployment. Do not
automatically reverse a database migration: additive migrations are usually
safe to leave in place, while destructive migrations need a reviewed plan.

## Migration policy

- Migrations in `prisma/migrations` are append-only after they are applied.
- Use additive changes first (add column, backfill, then remove in a later
  release).
- Test destructive changes on a Neon branch and take a snapshot first.
- Never run `prisma migrate reset` against production.
- Builds do not migrate; migrations are an explicit release step.

## Restore drill

Quarterly, restore the latest snapshot to a temporary branch and verify:

- the branch starts and the app can connect with a temporary URL;
- `npm run db:verify` passes;
- a sample trip, template, competition, and audit row are readable;
- the temporary branch is deleted after the drill.

## RPO / RTO

Document the current values before launch. Until measured, do not claim a
recovery target. The restore drill provides the evidence.
