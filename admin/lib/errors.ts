export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly headers?: Record<string, string>;

  constructor(message: string, status: number, code: string, headers?: Record<string, string>) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export class PayloadTooLargeError extends HttpError {
  constructor(message = "Request body is too large", code = "payload_too_large") {
    super(message, 413, code);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Forbidden", code = "forbidden") {
    super(message, 403, code);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not found", code = "not_found") {
    super(message, 404, code);
  }
}

export class ConflictError extends HttpError {
  constructor(message: string, code = "conflict") {
    super(message, 409, code);
  }
}

export class ValidationError extends HttpError {
  constructor(message: string, code = "invalid_request") {
    super(message, 400, code);
  }
}
