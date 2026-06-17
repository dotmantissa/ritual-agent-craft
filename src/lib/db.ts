import { neon } from '@neondatabase/serverless';

type SqlFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>;

let _sql: SqlFn | undefined;

export function getDb(): SqlFn {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL env var not set');
    _sql = neon(url) as unknown as SqlFn;
  }
  return _sql;
}
