export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} excedeu ${Math.round(ms / 1_000)}s`);
    this.name = "TimeoutError";
  }
}

/** Rejeita se a operacao nao terminar dentro do prazo, evitando que um ciclo fique preso. */
export async function withTimeout<T>(operation: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
