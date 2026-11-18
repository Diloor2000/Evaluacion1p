import { parentPort, workerData } from "node:worker_threads";

function contarPrimos(n: number): number {
  if (!Number.isSafeInteger(n) || n < 2) return 0;

  const primos = new Uint8Array(n);
  primos.fill(1);
  primos[0] = 0;
  if (n > 1) primos[1] = 0;

  for (let i = 2; i * i < n; i++) {
    if (primos[i]) {
      for (let j = i * i; j < n; j += i) primos[j] = 0;
    }
  }

  let total = 0;
  for (let i = 2; i < n; i++) if (primos[i]) total++;
  return total;
}

try {
  parentPort?.postMessage({ primos: contarPrimos(workerData.n) });
} catch (error) {
  parentPort?.postMessage({
    error: error instanceof Error ? error.message : "Error desconocido en el hilo"
  });
}
