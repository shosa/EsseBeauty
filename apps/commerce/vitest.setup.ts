import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(import.meta.dirname, "..", "..", ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
