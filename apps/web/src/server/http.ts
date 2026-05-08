import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export async function readJson<T>(request: Request, schema: ZodSchema<T>) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "O corpo da requisição precisa ser um JSON válido.");
  }

  return schema.parse(body);
}

export function validateParams<T>(params: unknown, schema: ZodSchema<T>) {
  return schema.parse(params);
}

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "validation_error",
          message: "Dados da requisição inválidos.",
          details: error.flatten()
        }
      },
      { status: 400 }
    );
  }

  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      },
      { status: error.status }
    );
  }

  if (error instanceof Error && error.message.toLowerCase().includes("timeout exceeded when trying to connect")) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "database_connection_timeout",
          message: "O banco de dados demorou para responder. Tente novamente em alguns instantes."
        }
      },
      { status: 503 }
    );
  }

  console.error(error);

  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "internal_error",
        message: "Erro inesperado no servidor."
      }
    },
    { status: 500 }
  );
}
