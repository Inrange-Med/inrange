// Postgres access. Each request gets its own short-lived client (opened lazily on the first query,
// closed when the response is done): edge workers freeze between requests, and pooled sockets that
// sat idle hang on reuse. The transaction pooler (DB_POOLER_URL, port 6543) makes connecting cheap.
// Use the tagged template as usual: sql`select ... where id = ${id}`; transactions: sql.begin(async (tx) => ...).
// index.ts wraps every request in withDb().
import postgres from "postgres";
import { AsyncLocalStorage } from "node:async_hooks";
import { env } from "./env.ts";

const makeClient = () =>
  postgres(env.dbUrl, {
    prepare: false,
    max: 3,
    connect_timeout: 10,
    idle_timeout: 0,
    max_lifetime: null,
    transform: { undefined: null },
    types: { numeric: { to: 1700, from: [1700], serialize: (v: number) => String(v), parse: (v: string) => Number(v) } },
  });

type Client = ReturnType<typeof makeClient>;
const scope = new AsyncLocalStorage<Client>();

export async function withDb<T>(fn: () => Promise<T>): Promise<T> {
  const client = makeClient();
  try {
    return await scope.run(client, fn);
  } finally {
    // close before the response leaves: a socket still open after it can keep a dying worker in rotation
    await client.end({ timeout: 1 }).catch(() => {});
  }
}

// Outside a request (module load) routes only build reusable SQL fragments, which need a client to
// construct but never connect; this lazy client stands in for that and is never awaited directly.
let fragmentClient: Client | null = null;
function current(): Client {
  return scope.getStore() ?? (fragmentClient ??= makeClient());
}

export const sql = new Proxy((() => {}) as unknown as Client, {
  apply: (_t, thisArg, args) => Reflect.apply(current() as unknown as (...a: unknown[]) => unknown, thisArg, args),
  get: (_t, prop) => {
    const client = current();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
