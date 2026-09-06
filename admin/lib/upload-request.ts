import "server-only";

import Busboy from "busboy";
import { PayloadTooLargeError, ValidationError } from "./errors";
import { MAX_UPLOAD_BYTES } from "./gcs";

const MAX_MULTIPART_OVERHEAD_BYTES = 64 * 1024;
export const MAX_MULTIPART_BODY_BYTES = MAX_UPLOAD_BYTES + MAX_MULTIPART_OVERHEAD_BYTES;

export async function readImageUpload(request: Request): Promise<Buffer> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BODY_BYTES) {
    throw new PayloadTooLargeError();
  }
  if (!request.body) throw new ValidationError("A file field with an image upload is required", "file_missing");

  let parser: ReturnType<typeof Busboy>;
  try {
    parser = Busboy({
      headers: Object.fromEntries(request.headers),
      limits: { fileSize: MAX_UPLOAD_BYTES + 1, files: 1, fields: 0, parts: 1 },
    });
  } catch {
    throw new ValidationError("Invalid multipart upload", "invalid_multipart");
  }

  const chunks: Buffer[] = [];
  let fileSeen = false;
  let fileTooLarge = false;
  let invalidParts = false;
  let parserFailure: unknown;
  const parserError = new Promise<never>((_resolve, reject) => {
    parser.once("error", (error) => {
      parserFailure = error;
      reject(error);
    });
  });
  parser.on("file", (name, stream) => {
    if (name !== "file" || fileSeen) {
      invalidParts = true;
      stream.resume();
      return;
    }
    fileSeen = true;
    stream.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    stream.on("limit", () => { fileTooLarge = true; });
  });
  parser.on("field", () => { invalidParts = true; });
  parser.on("filesLimit", () => { invalidParts = true; });
  parser.on("fieldsLimit", () => { invalidParts = true; });
  parser.on("partsLimit", () => { invalidParts = true; });

  let total = 0;
  const reader = request.body.getReader();
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), parserError]);
      if (done) break;
      total += value.byteLength;
      if (total > MAX_MULTIPART_BODY_BYTES) throw new PayloadTooLargeError();
      if (!parser.write(Buffer.from(value))) {
        await Promise.race([new Promise<void>((resolve) => parser.once("drain", resolve)), parserError]);
      }
      if (fileTooLarge) throw new PayloadTooLargeError("Image exceeds the 5 MB limit", "file_too_large");
    }
    const finished = new Promise<void>((resolve) => {
      parser.once("finish", resolve);
    });
    parser.end();
    await Promise.race([finished, parserError]);
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    parser.destroy();
    throw error instanceof PayloadTooLargeError ? error : new ValidationError("Invalid multipart upload", "invalid_multipart");
  }

  if (parserFailure || invalidParts) throw new ValidationError("Upload must contain exactly one file field", "invalid_multipart");
  if (!fileSeen) throw new ValidationError("A file field with an image upload is required", "file_missing");
  if (fileTooLarge) throw new PayloadTooLargeError("Image exceeds the 5 MB limit", "file_too_large");
  return Buffer.concat(chunks);
}
