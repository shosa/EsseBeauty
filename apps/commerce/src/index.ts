import { createDatabase } from "@esse-beauty/db";
import { closeQueues } from "@esse-beauty/queue-client";

import { createApp } from "./app.js";
import { loadEnvironment } from "./env.js";

const env = loadEnvironment();
const db = createDatabase(env.DATABASE_URL);
const app = createApp({ db, env, logger: true });

app.addHook("onClose", async () => {
  await closeQueues();
});

try {
  await app.listen({
    host: env.API_HOST,
    port: env.PORT,
  });
} catch (error: unknown) {
  app.log.error(error);
  process.exit(1);
}
