type VerifiedLineToken = {
  lineUid: string;
  audience: string;
  expiresIn: number | null;
};

type LineVerifyResponse = {
  iss?: string;
  sub?: string;
  aud?: string;
  exp?: number;
};

const LINE_TOKEN_ISSUER = "https://access.line.me";
const MAX_LINE_ID_TOKEN_LENGTH = 4096;

type VerifyLineIdTokenOptions = {
  idToken: string;
  channelId?: string;
  fetchImpl?: typeof fetch;
};

export class LineTokenVerifyError extends Error {
  code:
    | "line_channel_id_missing"
    | "line_token_invalid"
    | "line_token_issuer_mismatch"
    | "line_token_audience_mismatch"
    | "line_token_expired"
    | "line_token_subject_missing"
    | "line_verify_rate_limited"
    | "line_verify_unavailable";
  httpStatus: 401 | 429 | 503;
  upstreamStatus?: number;
  lineRequestId?: string;

  constructor(
    code: LineTokenVerifyError["code"],
    message: string,
    options: {
      httpStatus?: LineTokenVerifyError["httpStatus"];
      upstreamStatus?: number;
      lineRequestId?: string;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = "LineTokenVerifyError";
    this.code = code;
    this.httpStatus = options.httpStatus ?? defaultHttpStatusForCode(code);
    this.upstreamStatus = options.upstreamStatus;
    this.lineRequestId = options.lineRequestId;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

function defaultHttpStatusForCode(code: LineTokenVerifyError["code"]): LineTokenVerifyError["httpStatus"] {
  if (code === "line_verify_rate_limited") return 429;
  if (code === "line_channel_id_missing" || code === "line_verify_unavailable") return 503;
  return 401;
}

function classifyVerifyResponse(status: number): Pick<LineTokenVerifyError, "code" | "httpStatus"> {
  if (status === 429) {
    return { code: "line_verify_rate_limited", httpStatus: 429 };
  }
  if (status >= 500) {
    return { code: "line_verify_unavailable", httpStatus: 503 };
  }
  return { code: "line_token_invalid", httpStatus: 401 };
}

export async function verifyLineIdToken({
  idToken,
  channelId = process.env.LINE_CHANNEL_ID,
  fetchImpl = fetch,
}: VerifyLineIdTokenOptions): Promise<VerifiedLineToken> {
  if (!channelId) {
    throw new LineTokenVerifyError("line_channel_id_missing", "LINE_CHANNEL_ID is not configured");
  }
  if (idToken.length > MAX_LINE_ID_TOKEN_LENGTH) {
    throw new LineTokenVerifyError("line_token_invalid", "LINE ID token is too large");
  }

  const body = new URLSearchParams({ id_token: idToken, client_id: channelId });
  let response: Response;
  try {
    response = await fetchImpl("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch (error) {
    throw new LineTokenVerifyError("line_verify_unavailable", "LINE ID token verification is temporarily unavailable", {
      httpStatus: 503,
      cause: error,
    });
  }

  if (!response.ok) {
    const { code, httpStatus } = classifyVerifyResponse(response.status);
    throw new LineTokenVerifyError(code, "LINE ID token verification failed", {
      httpStatus,
      upstreamStatus: response.status,
      lineRequestId: response.headers.get("x-line-request-id") ?? undefined,
    });
  }

  const payload = (await response.json()) as LineVerifyResponse;
  if (payload.iss !== LINE_TOKEN_ISSUER) {
    throw new LineTokenVerifyError("line_token_issuer_mismatch", "LINE ID token issuer mismatch");
  }
  if (payload.aud !== channelId) {
    throw new LineTokenVerifyError("line_token_audience_mismatch", "LINE ID token audience mismatch");
  }
  if (typeof payload.exp === "number" && payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new LineTokenVerifyError("line_token_expired", "LINE ID token is expired");
  }
  if (!payload.sub) {
    throw new LineTokenVerifyError("line_token_subject_missing", "LINE ID token subject is missing");
  }

  return {
    lineUid: payload.sub,
    audience: payload.aud,
    expiresIn: typeof payload.exp === "number" ? Math.max(payload.exp - Math.floor(Date.now() / 1000), 0) : null,
  };
}
