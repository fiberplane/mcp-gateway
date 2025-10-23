# SQLite Storage Hookup - Architecture Clarification

## Question

"I'm not quite sure what will hook up the sqlite storage, whether that's the cli, the api (as i just suggested) or something else entirely"

## Answer: Both CLI and API Hook Up SQLite

The SQLite storage is hooked up in **two places**, depending on which mode you're running:

---

## 1. Core Package Writes to SQLite (Always)

**Location:** `packages/core/src/capture/index.ts`

**When:** Whenever MCP traffic is captured (both TUI-only mode and --ui mode)

```typescript
// packages/core/src/capture/index.ts
import { getDb, ensureMigrations, insertLog } from '../logs'

export async function appendCapture(
  storageDir: string,
  record: CaptureRecord,
): Promise<string> {
  // 1. Write to JSONL (existing backup system)
  const filename = await appendToJSONL(storageDir, record)

  // 2. Write to SQLite (new query system)
  try {
    const db = getDb(storageDir)

    // Ensure migrations have run before attempting insert
    await ensureMigrations(db)

    await insertLog(db, record)
  } catch (err) {
    // Don't fail if SQLite write fails
    logger.error('Failed to write to SQLite', err)
  }

  return filename
}
```

**This means:**
- ✅ SQLite is populated **automatically** whenever the gateway captures traffic
- ✅ Works in **both** TUI-only mode and API mode
- ✅ Migrations run **before first write** (idempotent, safe to call repeatedly)

---

## 2. API Package Ensures Migrations on Startup

**Location:** `packages/api/src/app.ts`

**When:** When the API server starts (only in --ui mode)

```typescript
// packages/api/src/app.ts
import { getDb, ensureMigrations } from '@fiberplane/mcp-gateway-core'

export async function createApp(storageDir: string) {
  // Proactively run migrations before API starts accepting requests
  const db = getDb(storageDir)
  await ensureMigrations(db)

  const app = new Hono()

  // Mount routes that query SQLite
  app.route('/api/logs', logsRoutes)
  app.route('/api/servers', serversRoutes)
  app.route('/api/sessions', sessionsRoutes)

  return app
}
```

**This means:**
- ✅ Migrations run **proactively** when API starts
- ✅ Database is ready **before** first HTTP request
- ✅ Safe even if no traffic has been captured yet
- ✅ Prevents race condition with early traffic capture

---

## 3. Migration Strategy: Thread-Safe & Idempotent

**Key Design:**

```typescript
// packages/core/src/logs/migrations.ts
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'

let migrationPromise: Promise<void> | null = null

export async function ensureMigrations(db: BunSQLiteDatabase): Promise<void> {
  // If migrations are already running, wait for them
  if (migrationPromise) {
    return migrationPromise
  }

  // Start migrations (only once)
  migrationPromise = (async () => {
    try {
      await migrate(db, { migrationsFolder: './drizzle' })
      logger.info('Database migrations completed')
    } catch (err) {
      logger.error('Migration failed', err)
      migrationPromise = null // Allow retry on failure
      throw err
    }
  })()

  return migrationPromise
}
```

**This means:**
- ✅ **Thread-safe** - Multiple concurrent calls wait on same promise
- ✅ **Single execution** - Migrations run once per process
- ✅ **Idempotent** - Drizzle tracks applied migrations in `__drizzle_migrations` table
- ✅ **No race conditions** - First caller runs, others wait
- ✅ **Retry on failure** - If migration fails, next call will retry

---

## Flow Diagram

### Scenario 1: CLI without --ui flag (TUI-only mode)

```
┌─────────────────────────────────────────────────────────┐
│ User runs: mcp-gateway                                  │
└───────────────────┬─────────────────────────────────────┘
                    ↓
        ┌───────────────────────┐
        │ CLI starts TUI        │
        └───────────┬───────────┘
                    ↓
        ┌───────────────────────────┐
        │ MCP traffic captured      │
        └───────────┬───────────────┘
                    ↓
        ┌────────────────────────────────────────────────┐
        │ Core: appendCapture()                         │
        │   1. Write to JSONL                           │
        │   2. Run migrations (first time only)         │
        │   3. Insert to SQLite via Drizzle             │
        └────────────────────────────────────────────────┘
```

**Result:** SQLite is populated, but no web UI to query it.

---

### Scenario 2: CLI with --ui flag (TUI + Web UI mode)

```
┌─────────────────────────────────────────────────────────┐
│ User runs: mcp-gateway --ui                             │
└───────────────────┬─────────────────────────────────────┘
                    ↓
        ┌───────────────────────┐
        │ CLI starts TUI        │
        └───────────┬───────────┘
                    ↓
        ┌────────────────────────────────────────────────┐
        │ CLI starts API server                         │
        │   - createApp(storageDir)                     │
        │   - runMigrations(db)  ← Ensures DB ready    │
        └───────────┬────────────────────────────────────┘
                    ↓
        ┌───────────────────────────┐
        │ API server listening      │
        │ http://localhost:3000     │
        └───────────┬───────────────┘
                    │
        ┌───────────┴───────────────────────────────────┐
        │                                               │
        ↓                                               ↓
┌───────────────────────┐                   ┌──────────────────────┐
│ MCP traffic captured  │                   │ User opens browser   │
│ → appendCapture()     │                   │ http://localhost:3000│
│   1. JSONL            │                   └──────────┬───────────┘
│   2. SQLite           │                              ↓
└───────────────────────┘                   ┌──────────────────────┐
                                            │ Browser: GET /api/logs│
                                            └──────────┬───────────┘
                                                       ↓
                                            ┌──────────────────────┐
                                            │ API: queryLogs(db)   │
                                            │ (uses Drizzle)       │
                                            └──────────┬───────────┘
                                                       ↓
                                            ┌──────────────────────┐
                                            │ SQLite query results │
                                            │ → JSON response      │
                                            └──────────────────────┘
```

**Result:** SQLite is populated AND queryable via web UI.

---

## Summary Table

| Component | Responsibility | When It Runs |
|-----------|---------------|--------------|
| **Core Package** | Write to SQLite when traffic captured | Always (both modes) |
| **Core Package** | Run migrations on first write | First capture |
| **API Package** | Run migrations on startup | API startup (--ui mode) |
| **API Package** | Query SQLite for web UI | HTTP requests |

---

## Key Takeaways

1. **SQLite writes happen in Core** - `appendCapture()` writes to both JSONL and SQLite
2. **Migrations run in two places** - First write (Core) OR API startup (API)
3. **API startup migrations are defensive** - Ensures DB is ready even if no traffic yet
4. **Idempotent migrations** - Safe to call multiple times, Drizzle tracks state

---

## Benefits of This Design

✅ **Separation of Concerns**
- Core = Data capture
- API = Data querying

✅ **Works in Both Modes**
- TUI-only: SQLite populated (for future use)
- TUI + API: SQLite populated AND queryable

✅ **Defensive Migration Strategy**
- Migrations run ASAP (either first write or API startup)
- No manual "setup" step required

✅ **Graceful Degradation**
- If SQLite write fails, JSONL still works
- Can rebuild SQLite from JSONL later

---

## Race Condition Prevention

**Question:** Won't there be a race condition where `appendCapture()` tries to insert before migrations run?

**Answer:** No! The `ensureMigrations()` function is thread-safe:

### Scenario: Early Traffic Capture

```typescript
Time    Thread 1 (Traffic Capture)          Thread 2 (API Startup)
----    ---------------------------          ----------------------
t=0     CLI starts...
t=1                                          createApp() called
t=1                                          → ensureMigrations() called
t=1                                          → migrationPromise created
t=1                                          → Running migration...
t=2     First traffic captured!
t=2     → appendCapture() called
t=2     → ensureMigrations() called
t=2     → Sees migrationPromise exists
t=2     → WAITS on same promise ✅
t=3                                          → Migration completes
t=3     → appendCapture() resumes
t=3     → insertLog() succeeds ✅
```

**Key insight:** Both paths call `ensureMigrations()`, and it returns the same promise. Whoever calls it second just waits for the first caller to finish.

---

## Your Questions Answered

### Q1: "What hooks up the SQLite storage?"

**Answer:**

- **Core package** writes to SQLite (via `appendCapture()`)
- **API package** runs migrations on startup (via `createApp()`)
- **CLI** doesn't directly touch SQLite, it just orchestrates Core and API

**In other words:**
- Core = Producer (writes logs)
- API = Consumer (reads logs)
- CLI = Orchestrator (starts Core and optionally API)

### Q2: "Won't this cause issues where the DB might get used before migrations have been run?"

**Answer:** No, because:

1. **Both write and read paths** call `ensureMigrations()`
2. **Promise-based singleton** ensures migrations run exactly once
3. **Thread-safe** - concurrent calls wait on the same promise
4. **No race conditions** - first caller runs, others wait
