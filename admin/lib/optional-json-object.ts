import { HttpError, PayloadTooLargeError, ValidationError } from "./errors";

const MAX_OPTIONAL_JSON_BYTES = 4_096;

function isJsonContentType(value: string | null): boolean {
  return value?.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
}

export async function readOptionalJsonObject(
  request: Request,
  maxBytes = MAX_OPTIONAL_JSON_BYTES,
): Promise<Record<string, unknown>> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new PayloadTooLargeError();
  }

  if (!request.body) return {};

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new PayloadTooLargeError();
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  if (text.trim() === "") return {};
  if (!isJsonContentType(request.headers.get("content-type"))) {
    throw new HttpError("Content-Type must be application/json", 415, "unsupported_media_type");
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ValidationError("Request body must contain valid JSON", "invalid_json");
  }
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new ValidationError("Request body must be a JSON object", "invalid_json_object");
  }
  return value as Record<string, unknown>;
}
