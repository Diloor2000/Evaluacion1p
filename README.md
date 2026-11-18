# Evaluacion 1

Autor: Nombre Apellido
Usuario de GitHub: usuario-github

## Servicios

- **Agenda**: consulta medicos y reserva cupos. Puerto 3001.
- **Citas**: crea citas y coordina las reservas y notificaciones. Puerto 3000.
- **Notificaciones**: recibe avisos por socket TCP y los registra. Puerto 4000.

## Levantar el sistema

```bash
docker compose up -d --build
```

Las rutas principales son `http://localhost:3001`, `http://localhost:3000` y el socket TCP `localhost:4000`.

