/**
 * Utility to strip undefined values from objects before writing to Firestore
 * Prevents Firestore runtime serialization errors.
 */
export function sanitizeFirestorePayload<T extends Record<string, any>>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => sanitizeFirestorePayload(item)) as unknown as T;
  }

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = typeof value === 'object' && value !== null
        ? sanitizeFirestorePayload(value)
        : value;
    }
  }

  return cleaned as T;
}

/**
 * Clean and truncate string safely
 */
export function sanitizeText(text: unknown, maxLength: number = 20000): string {
  if (typeof text !== 'string') return '';
  return text.trim().slice(0, maxLength);
}
