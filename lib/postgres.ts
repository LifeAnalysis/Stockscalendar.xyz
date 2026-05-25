import { env } from "./env";

type QueryResult<T> = {
  rows: T[];
};

type PgPool = {
  query<T = unknown>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
};

let poolPromise: Promise<PgPool | null> | null = null;

function databaseUrl(): string {
  return env("DATABASE_URL") || env("POSTGRES_URL");
}

export function isPostgresConfigured(): boolean {
  return Boolean(databaseUrl());
}

export async function getPostgresPool(): Promise<PgPool | null> {
  const connectionString = databaseUrl();
  if (!connectionString) return null;
  if (!poolPromise) {
    poolPromise = import("pg").then(({ Pool }) => {
      const needsSsl = /sslmode=require/i.test(connectionString) || /railway|rlwy/i.test(connectionString);
      return new Pool({
        connectionString,
        max: 3,
        idleTimeoutMillis: 30000,
        ssl: needsSsl ? { rejectUnauthorized: false } : undefined
      }) as PgPool;
    });
  }
  return poolPromise;
}

