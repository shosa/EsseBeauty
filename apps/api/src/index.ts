import { createDatabase } from "@esse-beauty/db";

import { createApp } from "./app.js";
import { loadEnvironment } from "./env.js";
import { startMarketingWorker } from "./jobs/marketing.js";
import {
  registerReminderSchedule,
  startReminderWorker,
} from "./jobs/reminders.js";
import { startReviewWorker } from "./jobs/reviews.js";
import { closeQueues } from "./jobs/queues.js";

const env = loadEnvironment();
const db = createDatabase(env.DATABASE_URL);
const app = createApp({ db, env, logger: true });
const workers = [
  startReminderWorker(db),
  startReviewWorker(db),
  startMarketingWorker(db),
];
await registerReminderSchedule();

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
