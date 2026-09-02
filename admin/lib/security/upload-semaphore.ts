import "server-only";

import { HttpError } from "../errors";

const state = globalThis as typeof globalThis & { hugmeidActiveUploads?: number };

export function acquireUploadPermit(): () => void {
  const limit = Math.max(1, Number(process.env.ADMIN_UPLOAD_CONCURRENCY ?? 2));
  const active = state.hugmeidActiveUploads ?? 0;
  if (active >= limit) throw new HttpError("Upload capacity is busy", 503, "upload_busy", { "Retry-After": "1" });
  state.hugmeidActiveUploads = active + 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    state.hugmeidActiveUploads = Math.max(0, (state.hugmeidActiveUploads ?? 1) - 1);
  };
}
