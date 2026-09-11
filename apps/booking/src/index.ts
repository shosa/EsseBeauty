import { createDatabase } from "@esse-beauty/db";
import { closeQueues } from "@esse-beauty/queue-client";

import { createApp } from "./app.js";
import { loadEnvironment } from "./env.js";
import { startAppointmentFollowupWorker } from "./jobs/appointment-events.js";

const env = loadEnvironment();
const db = createDatabase(env.DATABASE_URL);
const app = createApp({ db, env, logger: true });
const workers = [
  startAppointmentFollowupWorker(db),
];

app.addHook("onClose", async () => {
  await Promise.all(workers.map((worker) => worker.close()));
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
