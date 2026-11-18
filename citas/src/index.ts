import express from "express";
import net from "node:net";
import { randomUUID } from "node:crypto";
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";

interface Cita {
  id: string;
  paciente: string;
  medicoId: string;
  creadaEn: string;
  notificada: boolean;
}

const app = express();
app.use(express.json());

const citas: Cita[] = [];
const agendaUrl = process.env.AGENDA_URL ?? "http://localhost:3001";
const agendaTimeout = Number(process.env.AGENDA_TIMEOUT_MS ?? 2000);
const notificacionesHost = process.env.NOTIFICACIONES_HOST ?? "localhost";
const notificacionesPort = Number(process.env.NOTIFICACIONES_PORT ?? 4000);
const notificacionesTimeout = Number(process.env.NOTIFICACIONES_TIMEOUT_MS ?? 1000);

app.get("/health", (_req, res) => {
  res.status(200).json({ estado: "ok", servicio: "citas" });
});

app.get("/citas", (_req, res) => {
  res.status(200).json(citas);
});

function enviarNotificacion(cita: Cita): Promise<{ ok: boolean; motivo?: string }> {
  return new Promise((resolve) => {
    let terminado = false;
    let pendiente = "";
    const socket = net.createConnection(
      { host: notificacionesHost, port: notificacionesPort },
      () => {
        socket.write(
          JSON.stringify({
            tipo: "CITA_CREADA",
            citaId: cita.id,
            paciente: cita.paciente,
            medicoId: cita.medicoId
          }) + "\n"
        );
      }
    );

    socket.setEncoding("utf8");
    socket.setTimeout(notificacionesTimeout);

    const finalizar = (resultado: { ok: boolean; motivo?: string }) => {
      if (terminado) return;
      terminado = true;
      socket.destroy();
      resolve(resultado);
    };

    socket.on("data", (trozo) => {
      pendiente += trozo;
      const fin = pendiente.indexOf("\n");
      if (fin === -1) return;

      try {
        const respuesta = JSON.parse(pendiente.slice(0, fin)) as { ok?: boolean };
        finalizar(respuesta.ok
          ? { ok: true }
          : { ok: false, motivo: "Notificaciones rechazó el aviso" });
      } catch {
        finalizar({ ok: false, motivo: "Respuesta TCP inválida" });
      }
    });

    socket.on("timeout", () => finalizar({
      ok: false,
      motivo: `Tiempo de espera agotado (${notificacionesTimeout} ms)`
    }));
    socket.on("error", (error: NodeJS.ErrnoException) => finalizar({
      ok: false,
      motivo: `No se pudo conectar con Notificaciones: ${error.code ?? error.message}`
    }));
  });
}

app.post("/citas", async (req, res) => {
  const paciente = typeof req.body?.paciente === "string" ? req.body.paciente.trim() : "";
  const medicoId = typeof req.body?.medicoId === "string" ? req.body.medicoId.trim() : "";

  if (!paciente || !medicoId) {
    return res.status(400).json({ error: "paciente y medicoId son obligatorios" });
  }

  const inicio = performance.now();
  let respuestaAgenda: globalThis.Response;
  try {
    respuestaAgenda = await fetch(`${agendaUrl}/medicos/${encodeURIComponent(medicoId)}/reservar`, {
      method: "POST",
      signal: AbortSignal.timeout(agendaTimeout)
    });
  } catch (error) {
    const duracionMs = Math.round(performance.now() - inicio);
    const cause = error instanceof Error ? error : new Error(String(error));
    const nestedCause = "cause" in cause ? (cause as Error & { cause?: unknown }).cause : undefined;
    const nestedCode = nestedCause && typeof nestedCause === "object" && "code" in nestedCause
      ? String((nestedCause as { code?: unknown }).code)
      : undefined;
    const code = "code" in cause
      ? String((cause as NodeJS.ErrnoException).code)
      : nestedCode;
    const esTimeout = cause.name === "TimeoutError" || cause.name === "AbortError";
    const motivo = esTimeout
      ? `Agenda no respondió dentro del límite (${agendaTimeout} ms)`
      : `No se pudo conectar con Agenda${code ? `: ${code}` : `: ${cause.message}`}`;
    console.log(`Error con Agenda: ${motivo}; duracionMs=${duracionMs}`);
    return res.status(503).json({ motivo, duracionMs });
  }

  const duracionMs = Math.round(performance.now() - inicio);
  if (respuestaAgenda.status === 404 || respuestaAgenda.status === 409) {
    let agendaBody: unknown;
    try {
      agendaBody = await respuestaAgenda.json();
    } catch {
      agendaBody = null;
    }
    const mensaje = agendaBody && typeof agendaBody === "object" && "error" in agendaBody
      ? String((agendaBody as { error: unknown }).error)
      : "Respuesta de Agenda";
    console.log(`Agenda respondió ${respuestaAgenda.status}: ${mensaje}; duracionMs=${duracionMs}`);
    return res.status(respuestaAgenda.status).json(agendaBody);
  }

  if (respuestaAgenda.status !== 200) {
    const texto = await respuestaAgenda.text();
    console.log(`Agenda respondió código inesperado ${respuestaAgenda.status}: ${texto}; duracionMs=${duracionMs}`);
    return res.status(502).json({
      motivo: "Agenda respondió un código inesperado",
      estadoAgenda: respuestaAgenda.status,
      duracionMs
    });
  }

  const cita: Cita = {
    id: randomUUID(),
    paciente,
    medicoId,
    creadaEn: new Date().toISOString(),
    notificada: false
  };

  const reserva = await respuestaAgenda.json() as { cuposRestantes?: number };
  const notificacion = await enviarNotificacion(cita);
  cita.notificada = notificacion.ok;
  citas.push(cita);

  const respuesta: Cita & { cuposRestantes?: number; motivoNotificacion?: string } = {
    ...cita,
    cuposRestantes: reserva.cuposRestantes
  };
  if (!notificacion.ok) respuesta.motivoNotificacion = notificacion.motivo;
  res.status(201).json(respuesta);
});

app.get("/reporte", (req, res) => {
  const n = req.query.n === undefined ? 8_000_000 : Number(req.query.n);
  if (!Number.isSafeInteger(n) || n < 0) {
    return res.status(400).json({ error: "n debe ser un entero no negativo" });
  }

  const inicio = performance.now();
  const workerUrl = fileURLToPath(new URL("./worker.js", import.meta.url));
  const worker = new Worker(workerUrl, { workerData: { n } });

  worker.once("message", (resultado: { primos?: number; error?: string }) => {
    worker.terminate();
    if (resultado.error) {
      return res.status(500).json({ error: "Error en el hilo trabajador", detalle: resultado.error });
    }
    res.status(200).json({
      modo: "worker",
      n,
      primos: resultado.primos,
      citasRegistradas: citas.length,
      duracionMs: Math.round(performance.now() - inicio)
    });
  });

  worker.once("error", (error) => {
    console.log(`Error en worker: ${error.message}`);
    res.status(500).json({ error: "Error en el hilo trabajador", detalle: error.message });
  });

  worker.once("exit", (code) => {
    if (code !== 0) {
      console.log(`Worker terminó con código ${code}`);
    }
  });
});

app.listen(3000, "0.0.0.0", () => {
  console.log("Citas escuchando en el puerto 3000");
});
