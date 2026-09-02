import { ReflectionRequestOptions } from '../types';

export interface ReflectionResponse {
  success: boolean;
  reflection: string;
  modelUsed: string;
  timestamp: string;
}

export async function requestGeminiReflection(
  options: ReflectionRequestOptions
): Promise<ReflectionResponse> {
  const response = await fetch('/api/gemini/reflect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    let errorMsg = 'Failed to generate reflection';
    try {
      const errJson = await response.json();
      errorMsg = errJson.error || errorMsg;
    } catch {
      errorMsg = `Server returned status ${response.status}`;
    }
    throw new Error(errorMsg);
  }

  const data: ReflectionResponse = await response.json();
  return data;
}
