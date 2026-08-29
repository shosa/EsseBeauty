import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const target = new URL(databaseUrl);
const databaseName = decodeURIComponent(target.pathname.replace(/^\//, ""));

if (!databaseName) {
  throw new Error("DATABASE_URL must include a database name");
}

const maintenanceDatabases = unique([
  process.env.POSTGRES_MAINTENANCE_DB,
  "postgres",
  "template1",
]);

let lastError;
let ensured = false;

for (const maintenanceDatabase of maintenanceDatabases) {
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = `/${encodeURIComponent(maintenanceDatabase)}`;

  const sql = postgres(adminUrl.toString(), { max: 1 });

  try {
    const existing = await sql`
      select 1
      from pg_database
      where datname = ${databaseName}
    `;

    if (existing.length === 0) {
      await sql.unsafe(`create database ${quoteIdentifier(databaseName)}`);
      console.log(`Created database ${databaseName}`);
    } else {
      console.log(`Database ${databaseName} already exists`);
    }

    await sql.end();
    ensured = true;
    break;
  } catch (error) {
    lastError = error;
    await sql.end();

    if (error?.code !== "3D000") {
      throw error;
    }
  }
}

if (!ensured) {
  throw lastError ?? new Error("Unable to connect to a maintenance database");
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
