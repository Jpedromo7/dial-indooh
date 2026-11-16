import pg from "pg";

const { Pool } = pg;
const BATCH_SIZE = 100;
const TABLES = [
  "User",
  "Media",
  "Playlist",
  "Screen",
  "PlaylistItem",
  "ScreenAssignment",
  "ScreenHeartbeat",
  "ScreenEvent",
  "ScreenCommand",
  "ScreenMirrorSession",
  "ScreenMirrorCandidate"
];

const sourceUrl = requireUrl("SOURCE_DATABASE_URL");
const targetUrl = requireUrl("TARGET_DATABASE_URL");

if (sourceUrl === targetUrl) {
  throw new Error("SOURCE_DATABASE_URL e TARGET_DATABASE_URL não podem apontar para o mesmo banco.");
}

const source = createPool(sourceUrl);
const target = createPool(targetUrl);

try {
  await verifyDatabase(source, "origem");
  await verifyDatabase(target, "destino");

  const targetClient = await target.connect();

  try {
    await targetClient.query("BEGIN");

    for (const table of TABLES) {
      const result = await source.query(`SELECT * FROM ${quoteIdentifier(table)}`);
      const columns = result.fields.map((field) => field.name);

      for (let offset = 0; offset < result.rows.length; offset += BATCH_SIZE) {
        const batch = result.rows.slice(offset, offset + BATCH_SIZE);
        await upsertBatch(targetClient, table, columns, batch);
      }

      const targetCount = await targetClient.query(`SELECT COUNT(*)::int AS count FROM ${quoteIdentifier(table)}`);
      const copiedCount = Number(targetCount.rows[0].count);

      if (copiedCount < result.rowCount) {
        throw new Error(`${table}: destino contém ${copiedCount} linhas, mas a origem contém ${result.rowCount}.`);
      }

      console.log(`${table}: ${result.rowCount} linha(s) copiadas; ${copiedCount} no destino.`);
    }

    await targetClient.query("COMMIT");
  } catch (error) {
    await targetClient.query("ROLLBACK");
    throw error;
  } finally {
    targetClient.release();
  }
} finally {
  await Promise.allSettled([source.end(), target.end()]);
}

async function upsertBatch(client, table, columns, rows) {
  if (rows.length === 0) {
    return;
  }

  const values = [];
  const tuples = rows.map((row) => {
    const placeholders = columns.map((column) => {
      values.push(row[column]);
      return `$${values.length}`;
    });
    return `(${placeholders.join(", ")})`;
  });
  const updates = columns
    .filter((column) => column !== "id")
    .map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`)
    .join(", ");

  await client.query(
    `INSERT INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(", ")})
     VALUES ${tuples.join(", ")}
     ON CONFLICT ("id") DO UPDATE SET ${updates}`,
    values
  );
}

async function verifyDatabase(pool, label) {
  const result = await pool.query("SELECT current_database() AS database, current_user AS username");
  console.log(`Banco de ${label} conectado: ${result.rows[0].database} (${result.rows[0].username}).`);
}

function createPool(connectionString) {
  return new Pool({
    connectionString,
    max: 2,
    connectionTimeoutMillis: 30000,
    ssl: { rejectUnauthorized: false }
  });
}

function requireUrl(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} precisa estar configurado.`);
  }

  const parsed = new URL(value);
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(`${name} precisa ser uma URL PostgreSQL.`);
  }

  return value;
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}
