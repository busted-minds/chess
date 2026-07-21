import "server-only";

import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "INVALID_JSON"
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "ORIGIN_REJECTED"
  | "NOT_CONFIGURED"
  | "DEPENDENCY_UNAVAILABLE"
  | "INTERNAL_ERROR";

type ErrorOptions = {
  requestId?: string;
  details?: unknown;
  headers?: HeadersInit;
};

const responseHeaders = (requestId: string, headers?: HeadersInit): Headers => {
  const result = new Headers(headers);
  result.set("Cache-Control", "no-store");
  result.set("X-Request-Id", requestId);
  return result;
};

const camelCaseAliases = (data: unknown): Record<string, unknown> => {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const source = data as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(source)
      .filter(([key]) => key.includes("_"))
      .map(([key, value]) => [
        key.replace(/_([a-z])/gu, (_match, letter: string) => letter.toUpperCase()),
        value,
      ]),
  );
};

export const requestIdFor = (request: Request): string => {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && /^[a-zA-Z0-9._:-]{8,128}$/u.test(supplied)
    ? supplied
    : crypto.randomUUID();
};

export function apiSuccess<T>(
  data: T,
  options: { status?: number; requestId?: string; headers?: HeadersInit } = {},
): NextResponse {
  const requestId = options.requestId ?? crypto.randomUUID();
  return NextResponse.json(
    {
      ok: true,
      data,
      ...(data && typeof data === "object" && !Array.isArray(data) ? data : {}),
      ...camelCaseAliases(data),
      requestId,
    },
    {
      status: options.status ?? 200,
      headers: responseHeaders(requestId, options.headers),
    },
  );
}

export function apiError(
  status: number,
  code: ApiErrorCode | string,
  message: string,
  options: ErrorOptions = {},
): NextResponse {
  const requestId = options.requestId ?? crypto.randomUUID();
  return NextResponse.json(
    {
      ok: false,
      error: message,
      code,
      message,
      ...(options.details === undefined ? {} : { details: options.details }),
      requestId,
    },
    { status, headers: responseHeaders(requestId, options.headers) },
  );
}

export async function parseJson<T>(
  request: Request,
  schema: ZodType<T>,
  requestId: string,
): Promise<{ data: T; response?: never } | { data?: never; response: NextResponse }> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 32_768) {
    return {
      response: apiError(413, "BAD_REQUEST", "The request body is too large.", {
        requestId,
      }),
    };
  }

  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return {
      response: apiError(400, "INVALID_JSON", "Send a valid JSON request body.", {
        requestId,
      }),
    };
  }

  // The public UI uses the standard Idempotency-Key header. Accept the older
  // x-prefixed spelling and normalize the initial clock field at the boundary.
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const normalized = { ...(value as Record<string, unknown>) };
    const idempotencyKey =
      request.headers.get("idempotency-key") ??
      request.headers.get("x-idempotency-key");
    if (normalized.idempotencyKey === undefined && idempotencyKey) {
      normalized.idempotencyKey = idempotencyKey;
    }
    if (normalized.baseTimeMs === undefined && normalized.initialTimeMs !== undefined) {
      normalized.baseTimeMs = normalized.initialTimeMs;
    }
    delete normalized.initialTimeMs;
    delete normalized.timeControl;
    value = normalized;
  }

  try {
    return { data: schema.parse(value) };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        response: apiError(422, "VALIDATION_ERROR", "Some fields are invalid.", {
          requestId,
          details: error.issues.map(({ path, message, code }) => ({
            path: path.join("."),
            message,
            code,
          })),
        }),
      };
    }
    throw error;
  }
}

export function logServerEvent(
  level: "info" | "warn" | "error",
  event: string,
  fields: Readonly<Record<string, unknown>> = {},
): void {
  const entry = JSON.stringify({
    level,
    event,
    at: new Date().toISOString(),
    ...fields,
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}
