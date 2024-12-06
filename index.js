import { Server } from "duwende";

console.log("Current working directory:", process.cwd());

const duwende = new Server();

duwende
  .start()
  .then(() => {
    console.log("Duwende server started successfully");
  })
  .catch((error) => {
    console.error("Failed to start Duwende server:", error);
  });
