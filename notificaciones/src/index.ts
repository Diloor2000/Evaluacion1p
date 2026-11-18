import net from "node:net";

const server = net.createServer((socket) => {
  let pendiente = "";
  socket.setEncoding("utf8");

  socket.on("data", (trozo) => {
    pendiente += trozo;
    let fin = pendiente.indexOf("\n");

    while (fin !== -1) {
      const linea = pendiente.slice(0, fin);
      pendiente = pendiente.slice(fin + 1);

      if (linea.length === 0) continue;
      try {
        const aviso = JSON.parse(linea) as {
          tipo?: string;
          citaId?: string;
          paciente?: string;
          medicoId?: string;
        };
        console.log(
          `${aviso.tipo ?? "DESCONOCIDO"} cita=${aviso.citaId ?? ""} paciente=${aviso.paciente ?? ""} medico=${aviso.medicoId ?? ""}`
        );
        socket.write(JSON.stringify({ ok: true, recibido: aviso.citaId ?? "" }) + "\n");
      } catch {
        socket.write(JSON.stringify({ ok: false, error: "JSON inválido" }) + "\n");
      }

      fin = pendiente.indexOf("\n");
    }
  });
});

server.listen(4000, "0.0.0.0", () => {
  console.log("Notificaciones escuchando por TCP en el puerto 4000");
});
