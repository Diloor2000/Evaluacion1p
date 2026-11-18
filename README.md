# Evaluación 1

Autor: Diego Fernando Loor Rivas<br>
Usuario de GitHub: [Diloor2000](https://github.com/Diloor2000)

## Servicios

- **Agenda**: consulta médicos y reserva cupos. Puerto 3001.
- **Citas**: crea citas y coordina las reservas y notificaciones. Puerto 3000.
- **Notificaciones**: recibe avisos por socket TCP y los registra. Puerto 4000.

## Levantar el sistema

```bash
docker compose up -d --build
```

Para detener los servicios:

```bash
docker compose down
```

Rutas HTTP:

- Agenda: `http://localhost:3001/health`, `http://localhost:3001/medicos`
- Citas: `http://localhost:3000/health`, `http://localhost:3000/citas`,
  `http://localhost:3000/reporte?n=15000000`
- Notificaciones acepta conexiones TCP en `localhost:4000`.

Para probar una cita, envía `POST http://localhost:3000/citas` con JSON:

```json
{
  "paciente": "Diego Fernando Loor Rivas",
  "medicoId": "MED-01"
}
```

