import { createDatabase } from "@esse-beauty/db";

import { createApp } from "./app.js";
import { loadEnvironment } from "./env.js";
import { createSupabaseAdmin } from "./routes/auth/supabase-admin.js";
import { startMarketingWorker } from "./jobs/marketing.js";
import {
  registerReminderSchedule,
  startReminderWorker,
} from "./jobs/reminders.js";
import { startReviewWorker } from "./jobs/reviews.js";
import { closeQueues } from "./jobs/queues.js";

const env = loadEnvironment();
const db = createDatabase(env.DATABASE_URL);
const supabaseAdmin = createSupabaseAdmin(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);
const app = createApp({ db, env, logger: true, supabaseAdmin });
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
