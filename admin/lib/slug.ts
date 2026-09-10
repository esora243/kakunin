import { ValidationError } from "./errors";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function assertValidSlug(slug: string): void {
  if (!SLUG_PATTERN.test(slug) || slug.length > 200) {
    throw new ValidationError("Slug must be URL-safe: lowercase letters, numbers, and hyphens only", "invalid_slug");
  }
}
