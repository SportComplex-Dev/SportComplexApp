export function jsonSafe(data: unknown): unknown {
  if (typeof data === "bigint") return data.toString();
  if (data === null || typeof data !== "object") return data;
  if (data instanceof Date) return data.toISOString();
  if (Array.isArray(data)) return data.map(jsonSafe);
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    copy[key] = jsonSafe(value);
  }
  return copy;
}

export function ok<T>(data: T) {
  return Response.json({ success: true, data: jsonSafe(data), timestamp: new Date().toISOString() });
}

export function created<T>(data: T) {
  return Response.json(
    { success: true, data: jsonSafe(data), timestamp: new Date().toISOString() },
    { status: 201 },
  );
}

export function fail(code: string, message: string, status = 400, details?: unknown) {
  return Response.json(
    { success: false, error: { code, message, details: jsonSafe(details) }, timestamp: new Date().toISOString() },
    { status },
  );
}
