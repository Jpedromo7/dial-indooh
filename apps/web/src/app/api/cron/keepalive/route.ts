import { createClient } from "@supabase/supabase-js";
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
    pingSupabaseStorage()
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
