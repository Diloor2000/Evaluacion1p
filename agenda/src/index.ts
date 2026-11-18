import express from "express";

interface Medico {
  id: string;
  nombre: string;
  especialidad: string;
  cupos: number;
}

const medicos: Medico[] = [
  { id: "MED-01", nombre: "Dra. Amaya Villacís", especialidad: "Medicina familiar", cupos: 20 },
  { id: "MED-02", nombre: "Dr. Mateo Cedeño", especialidad: "Pediatría", cupos: 1 },
  { id: "MED-03", nombre: "Dra. Elena Montalvo", especialidad: "Cardiología", cupos: 0 },
  { id: "MED-04", nombre: "Dr. Bruno Almeida", especialidad: "Dermatología", cupos: 8 },
  { id: "MED-05", nombre: "Dra. Valeria Paredes", especialidad: "Neurología", cupos: 12 }
];

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ estado: "ok", servicio: "agenda" });
});

app.get("/medicos", (_req, res) => {
  res.status(200).json(medicos);
});

app.post("/medicos/:id/reservar", async (req, res) => {
  const medico = medicos.find((item) => item.id === req.params.id);
  if (!medico) {
    return res.status(404).json({ error: "Médico no encontrado" });
  }

  if (medico.cupos <= 0) {
    return res.status(409).json({ error: "No quedan cupos", medicoId: medico.id });
  }

  medico.cupos -= 1;
  const retardo = Number(process.env.RETARDO_MS ?? 0);
  if (retardo > 0) await new Promise((resolve) => setTimeout(resolve, retardo));

  res.status(200).json({ medicoId: medico.id, cuposRestantes: medico.cupos });
});

app.listen(3001, "0.0.0.0", () => {
  console.log("Agenda escuchando en el puerto 3001");
});

