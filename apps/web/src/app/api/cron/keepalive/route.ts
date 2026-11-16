import { createClient } from "@supabase/supabase-js";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@/server/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "unauthorized",
        message: "Não autorizado"
        }
      },
      { status: 401 }
    );
  }

  const startedAt = Date.now();

  const [userCount, screenCount, bucketCount] = await Promise.all([
    prisma.user.count(),
    prisma.screen.count(),
    pingMediaStorage()
  ]);

  return Response.json({
    ok: true,
    data: {
      userCount,
      screenCount,
      bucketCount,
      durationMs: Date.now() - startedAt,
      timestamp: new Date().toISOString()
    }
  });
}

function pingMediaStorage() {
  return process.env.MEDIA_STORAGE_PROVIDER?.trim().toLowerCase() === "r2"
    ? pingR2Storage()
    : pingSupabaseStorage();
}

async function pingR2Storage() {
  const accountId = requireVariable("R2_ACCOUNT_ID");
  const accessKeyId = requireVariable("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireVariable("R2_SECRET_ACCESS_KEY");
  const bucket = requireVariable("MEDIA_STORAGE_BUCKET");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey }
  });

  try {
    const result = await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }));
    return result.KeyCount ?? 0;
  } finally {
    client.destroy();
  }
}

async function pingSupabaseStorage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL precisa estar configurado.");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY precisa estar configurado.");
  }

  const client = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { data, error } = await client.storage.listBuckets();

  if (error) {
    throw new Error(`Supabase storage keepalive failed: ${error.message}`);
  }

  return data.length;
}

function requireVariable(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} precisa estar configurado.`);
  }

  return value;
}
