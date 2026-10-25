// Local Postgres for development/tests without Docker or a Supabase project.
// Usage: node scripts/local-db.mjs   (keeps running; Ctrl+C to stop)
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const dataDir = new URL("../.local-pg", import.meta.url).pathname;
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: 54329,
  persistent: true,
});

if (!existsSync(`${dataDir}/PG_VERSION`)) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase("lumora");
} catch {
  // already exists
}
console.log("Local Postgres ready: postgresql://postgres:postgres@localhost:54329/lumora");
const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
