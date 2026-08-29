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

const adminUrl = new URL(databaseUrl);
adminUrl.pathname = "/postgres";

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
} finally {
  await sql.end();
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}
