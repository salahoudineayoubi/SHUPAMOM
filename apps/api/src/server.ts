import mongoose from "mongoose";
import { loadConfig } from "./config";
import { createApp } from "./app";

async function main() {
  const config = loadConfig();
  await mongoose.connect(config.MONGODB_URI);
  const app = createApp(config);
  const server = app.listen(config.PORT, () => {
    console.log(`shupamom-api listening on :${config.PORT} (${config.NODE_ENV})`);
  });
  const shutdown = async () => {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
