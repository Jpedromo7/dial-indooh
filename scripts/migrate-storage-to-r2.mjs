import { Readable } from "node:stream";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const { Pool } = pg;
const bucket = process.env.MEDIA_STORAGE_BUCKET?.trim() || "dial-indooh-media";
const sourceBucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || bucket;
const supabaseUrl = requireVariable("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
const supabaseKey = requireVariable("SUPABASE_SERVICE_ROLE_KEY");
const r2PublicUrl = requireHttpsUrl("R2_PUBLIC_URL").replace(/\/+$/, "");
const targetDatabaseUrl = requireVariable("TARGET_DATABASE_URL");
const oldPublicUrl = (
  process.env.SUPABASE_STORAGE_PUBLIC_URL || `${supabaseUrl}/storage/v1/object/public/${sourceBucket}`
).replace(/\/+$/, "");

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: {
    fetch: (input, init = {}) =>
      fetch(input, {
        ...init,
        signal: init.signal || AbortSignal.timeout(30000)
      })
  }
});
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${requireVariable("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: requireVariable("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireVariable("R2_SECRET_ACCESS_KEY")
  }
});
const database = new Pool({
  connectionString: targetDatabaseUrl,
  max: 1,
  connectionTimeoutMillis: 30000,
  ssl: { rejectUnauthorized: false }
});

let copied = 0;
let skipped = 0;
let updatedUrls = 0;

try {
  console.log("Listando arquivos no Supabase Storage...");
  const objects = await listObjectsRecursively();
  console.log(`${objects.length} arquivo(s) encontrado(s) no Supabase Storage.`);

  for (const object of objects) {
    const alreadyCopied = await r2ObjectMatches(object.path, object.size);

    if (alreadyCopied) {
      skipped += 1;
    } else {
      await copyObject(object);
      copied += 1;
    }

    updatedUrls += await updateMediaUrl(object.path);
    console.log(`${object.path}: ${alreadyCopied ? "já existia" : "copiado"}.`);
  }

  console.log(`Concluído: ${copied} copiado(s), ${skipped} ignorado(s), ${updatedUrls} URL(s) atualizada(s).`);
} finally {
  await Promise.allSettled([database.end(), r2.destroy()]);
}

async function listObjectsRecursively(prefix = "") {
  const objects = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(sourceBucket).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" }
    });

    if (error) {
      throw new Error(`Falha ao listar '${prefix || "/"}': ${error.message}`);
    }

    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;

      if (item.id === null) {
        objects.push(...(await listObjectsRecursively(path)));
      } else {
        objects.push({
          path,
          size: Number(item.metadata?.size || 0),
          mimeType: item.metadata?.mimetype || "application/octet-stream"
        });
      }
    }

    if (data.length < 100) {
      break;
    }

    offset += data.length;
  }

  return objects;
}

async function copyObject(object) {
  console.log(`Baixando ${object.path}...`);
  const { data, error } = await supabase.storage.from(sourceBucket).download(object.path);

  if (error || !data) {
    throw new Error(`Falha ao baixar '${object.path}': ${error?.message || "resposta vazia"}`);
  }

  const upload = new Upload({
    client: r2,
    params: {
      Bucket: bucket,
      Key: object.path,
      Body: Readable.fromWeb(data.stream()),
      ContentLength: object.size || data.size,
      ContentType: object.mimeType
    },
    leavePartsOnError: false
  });

  console.log(`Enviando ${object.path} ao R2...`);
  await upload.done();
}

async function r2ObjectMatches(path, expectedSize) {
  try {
    const result = await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: path }));
    return !expectedSize || Number(result.ContentLength) === expectedSize;
  } catch (error) {
    if (error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

async function updateMediaUrl(path) {
  const oldUrl = `${oldPublicUrl}/${encodeObjectPath(path)}`;
  const newUrl = `${r2PublicUrl}/${encodeObjectPath(path)}`;
  const result = await database.query('UPDATE "Media" SET "fileUrl" = $1 WHERE "fileUrl" = $2', [newUrl, oldUrl]);
  return result.rowCount;
}

function encodeObjectPath(path) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function requireHttpsUrl(name) {
  const value = requireVariable(name);
  const url = new URL(value);

  if (url.protocol !== "https:") {
    throw new Error(`${name} precisa ser uma URL HTTPS.`);
  }

  return value;
}

function requireVariable(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} precisa estar configurado.`);
  }

  return value;
}
