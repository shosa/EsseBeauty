import { createDatabase } from "@esse-beauty/db";
import { closeQueues } from "@esse-beauty/comms-contracts";

import { createApp } from "./app.js";
import { loadEnvironment } from "./env.js";
import { startMarketingWorker } from "./jobs/marketing.js";
import { startCampaignStatusRefreshWorker } from "./jobs/campaign-status.js";
import {
  registerLoyaltyBirthdaySchedule,
  startLoyaltyBirthdayWorker,
} from "./jobs/loyalty-birthdays.js";
import { startReviewLoyaltyAwardWorker } from "./jobs/loyalty-events.js";
import { startAppointmentFollowupWorker } from "./jobs/appointment-events.js";

const env = loadEnvironment();
const db = createDatabase(env.DATABASE_URL);
const app = createApp({ db, env, logger: true });
const workers = [
  startMarketingWorker(db),
  startLoyaltyBirthdayWorker(db),
  startAppointmentFollowupWorker(db),
  startCampaignStatusRefreshWorker(db),
  startReviewLoyaltyAwardWorker(db),
];
await registerLoyaltyBirthdaySchedule();

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
