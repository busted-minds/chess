import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type ServiceRpcSuccess<T> = { data: T; error?: never };
type ServiceRpcFailure = {
  data?: never;
  error: {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ServiceRpcResult<T> = ServiceRpcSuccess<T> | ServiceRpcFailure;

const firstRow = <T>(data: unknown): T =>
  (Array.isArray(data) && data.length === 1 ? data[0] : data) as T;

export async function callServiceRpc<T = unknown>(
  name: string,
  parameters: Record<string, unknown>,
): Promise<ServiceRpcResult<T>> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return {
      error: {
        status: 503,
        code: "NOT_CONFIGURED",
        message: "The trusted Supabase server connection is not configured.",
      },
    };
  }

  const { data, error } = await admin.rpc(name, parameters);
  if (!error) return { data: firstRow<T>(data) };

  if (error.code === "PGRST202" || error.code === "42883") {
    return {
      error: {
        status: 503,
        code: "DEPENDENCY_UNAVAILABLE",
        message: "The database API is not ready. Apply the latest Supabase migrations.",
      },
    };
  }

  const normalizedMessage = error.message.toLowerCase();
  if (error.code === "23505" || normalizedMessage.includes("idempotency")) {
    return {
      error: {
        status: 409,
        code: "CONFLICT",
        message: "This request conflicts with an operation that already completed.",
      },
    };
  }
  if (error.code === "22023" || error.code === "23514") {
    return {
      error: {
        status: 422,
        code: "VALIDATION_ERROR",
        message: "The database rejected an invalid operation.",
      },
    };
  }
  if (error.code === "42501") {
    return {
      error: { status: 403, code: "FORBIDDEN", message: "You cannot perform this action." },
    };
  }
  if (error.code === "P0002") {
    return {
      error: { status: 404, code: "NOT_FOUND", message: "The requested resource was not found." },
    };
  }
  if (error.code === "40001") {
    return {
      error: {
        status: 409,
        code: "STALE_VERSION",
        message: "The game changed. Reload its latest state before trying again.",
      },
    };
  }
  if (error.code === "55000") {
    return {
      error: {
        status: 409,
        code: "CONFLICT",
        message: "The operation is not valid in the resource's current state.",
      },
    };
  }
  if (normalizedMessage.includes("version") || normalizedMessage.includes("stale")) {
    return {
      error: {
        status: 409,
        code: "STALE_VERSION",
        message: "The game changed. Reload its latest state before trying again.",
      },
    };
  }
  if (normalizedMessage.includes("forbidden") || normalizedMessage.includes("not authorized")) {
    return {
      error: { status: 403, code: "FORBIDDEN", message: "You cannot perform this action." },
    };
  }
  if (normalizedMessage.includes("not found")) {
    return {
      error: { status: 404, code: "NOT_FOUND", message: "The requested resource was not found." },
    };
  }

  return {
    error: {
      status: 500,
      code: "DATABASE_ERROR",
      message: "The operation could not be completed safely.",
      details: { databaseCode: error.code },
    },
  };
}
