import { NextResponse } from "next/server";
import { z } from "zod";

const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/u;

export class ApiRequestError extends Error {
  constructor(public code: string, public status: number, message: string) { super(message); }
}

export interface RequestContext { requestId: string; route: string; startedAt: number; }

export function requestContext(request: Request, route: string): RequestContext {
  const incoming = request.headers.get("x-request-id");
  return { requestId: incoming && REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID(), route, startedAt: Date.now() };
}

export function apiError(context: RequestContext, code: string, message: string, status: number, headers?: HeadersInit, details?: unknown) {
  return NextResponse.json({ error: { code, message, requestId: context.requestId, ...(details === undefined ? {} : { details }) } }, { status, headers: { "x-request-id": context.requestId, ...headers } });
}

export function apiOk<T extends Record<string, unknown>>(context: RequestContext, body: T, status = 200, headers?: HeadersInit) {
  return NextResponse.json({ ...body, requestId: context.requestId }, { status, headers: { "x-request-id": context.requestId, ...headers } });
}

export async function parseJson<T>(request: Request, schema: z.ZodType<T>, maxBytes = 32_768): Promise<T> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new ApiRequestError("unsupported_media_type", 415, "Content-Type must be application/json.");
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) throw new ApiRequestError("payload_too_large", 413, "Request body is too large.");
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) throw new ApiRequestError("payload_too_large", 413, "Request body is too large.");
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new ApiRequestError("invalid_json", 400, "Request body is not valid JSON."); }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiRequestError("invalid_request", 400, "Request fields are invalid.");
  return parsed.data;
}

export function retryAfter(seconds: number): HeadersInit { return { "retry-after": String(Math.max(1, Math.ceil(seconds))) }; }
