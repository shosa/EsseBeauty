export interface ApiEnvironment {
  API_CORS_ORIGIN: string;
  API_HOST: string;
  DATABASE_URL: string;
  PORT: number;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_JWT_SECRET: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function loadEnvironment(): ApiEnvironment {
  const portValue = process.env.PORT ?? "3001";
  const port = Number(portValue);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("PORT must be a positive integer");
  }

  return {
    API_CORS_ORIGIN: required("API_CORS_ORIGIN"),
    API_HOST: process.env.API_HOST ?? "0.0.0.0",
    DATABASE_URL: required("DATABASE_URL"),
    PORT: port,
    SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),
    SUPABASE_URL: required("SUPABASE_URL"),
    SUPABASE_JWT_SECRET: required("SUPABASE_JWT_SECRET"),
  };
}
