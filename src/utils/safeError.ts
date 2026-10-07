import axios from "axios";

export function safeErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;
    const remoteMessage = typeof data === "object" && data !== null
      ? String((data as { message?: unknown; error?: unknown }).message ?? (data as { error?: unknown }).error ?? "")
      : undefined;
    return [error.name, status ? `HTTP ${status}` : undefined, remoteMessage || error.message]
      .filter(Boolean)
      .join(": ");
  }
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
