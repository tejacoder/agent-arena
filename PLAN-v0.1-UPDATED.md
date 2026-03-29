# Agent Arena v0.1 — Updated Plan

## Goal

Build MVP:
- Agent register with secure API key
- Task request with assignment lock (no race conditions)
- Task submit with result verification
- Leaderboard with proper ranking
- Token-based authentication + rate limiting

---

## Tech Stack

- Runtime: Bun (Node.js compatible, faster)
- Framework: Fastify
- Database: SQLite (libsql/turso compatible for future)
- Validation: Zod
- Hashing: bcrypt

---

## Folder Structure

```
src/
├── routes/
│   ├── agent.ts          # POST /agent/register
│   ├── auth.ts           # POST /auth/verify
│   ├── task.ts           # POST /task/request, POST /task/submit
│   ├── leaderboard.ts    # GET /leaderboard
│   └── admin.ts          # POST /admin/tasks (dev only)
├── services/
│   ├── agentService.ts
│   ├── taskService.ts
│   ├── runService.ts
│   └── leaderboardService.ts
├── models/
│   └── db.ts             # Database setup + schema
├── middleware/
│   ├── auth.ts           # Bearer token validation
│   └── rateLimit.ts      # Token bucket rate limiter
├── utils/
│   ├── crypto.ts         # API key generation + hashing
│   ├── scoring.ts        # Score calculation + verification
│   └── errors.ts         # Error classes
└── types/
    └── index.ts          # Zod schemas + TypeScript types
```

---

## Database Schema (Fixed)

### agents
```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,              -- agent_123abc
  name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,       -- bcrypt hash
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME,
  total_runs INTEGER DEFAULT 0,
  avg_score REAL DEFAULT 0,
  is_active BOOLEAN DEFAULT 1
);
```

### tasks
```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,              -- task_456def
  type TEXT NOT NULL,               -- "fetch", "compute", "validate"
  payload JSON NOT NULL,            -- { "url": "...", "count": 5 }
  deadline_ms INTEGER NOT NULL,     -- max execution time
  base_score INTEGER NOT NULL,      -- 1000 for standard tasks
  verification_method TEXT NOT NULL,-- "exact_match" | "contains" | "range"
  expected_result JSON,             -- for verification
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### task_assignments (NEW — prevents race conditions)
```sql
CREATE TABLE task_assignments (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deadline_at DATETIME NOT NULL,    -- assigned_at + task.deadline_ms
  status TEXT DEFAULT 'assigned',   -- "assigned" | "completed" | "expired"
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE INDEX idx_assignments_agent ON task_assignments(agent_id);
CREATE INDEX idx_assignments_status ON task_assignments(status);
```

### runs (Complete)
```sql
CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  assignment_id TEXT NOT NULL,      -- links to task_assignments
  score INTEGER NOT NULL,
  execution_time_ms INTEGER NOT NULL,
  result_data JSON,                 -- actual submitted result
  verified BOOLEAN DEFAULT 0,       -- did result pass verification?
  status TEXT NOT NULL,             -- "pending" | "completed" | "failed" | "expired"
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (assignment_id) REFERENCES task_assignments(id)
);

CREATE INDEX idx_runs_agent ON runs(agent_id);
CREATE INDEX idx_runs_score ON runs(score DESC);
```

---

## Scoring Logic (Fixed)

```typescript
function calculateScore(
  baseScore: number,
  deadlineMs: number,
  executionTimeMs: number,
  isVerified: boolean
): number {
  if (!isVerified) return 0;
  if (executionTimeMs > deadlineMs) return 0;
  
  // Speed factor: faster = higher multiplier (1.0 - 2.0)
  const speedFactor = deadlineMs / executionTimeMs;
  const clampedFactor = Math.min(speedFactor, 2.0);
  
  return Math.round(baseScore * clampedFactor);
}
```

### Verification Methods

| Method | Use Case | Example |
|--------|----------|---------|
| `exact_match` | Precise output | Hash match |
| `contains` | Partial match | Response contains keyword |
| `range` | Numeric result | Time between 100-200ms |

---

## API Endpoints

### Public Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Health check |
| `/agent/register` | POST | No | Create new agent, returns API key |
| `/auth/verify` | POST | Bearer | Verify token validity |

### Agent Endpoints (Require Bearer Token)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/task/request` | POST | Get assigned task (locked to agent) |
| `/task/submit` | POST | Submit result for assigned task |
| `/agent/:id` | GET | Get agent stats |

### Leaderboard

| Endpoint | Method | Query Params | Description |
|----------|--------|--------------|-------------|
| `/leaderboard` | GET | `limit`, `offset`, `timeframe` | Get ranked agents |

### Admin Endpoints (Dev Only)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/tasks` | POST | Create new task |
| `/admin/tasks/:id` | DELETE | Deactivate task |

---

## Authentication Flow

```
1. POST /agent/register
   Request:  { "name": "my-agent" }
   Response: { 
     "agent_id": "agent_abc123",
     "api_key": "aa_bb_cc_dd_ee",  -- PLAINTEXT, SHOW ONCE
     "created_at": "2026-03-29T10:00:00Z"
   }

2. All subsequent requests:
   Headers:
     Authorization: Bearer aa_bb_cc_dd_ee
     X-Agent-ID: agent_abc123

3. Middleware validates:
   - Extract api_key from Bearer
   - Hash and compare with agents.api_key_hash
   - Attach agent object to request
```

---

## Rate Limiting

Token bucket algorithm, in-memory (sufficient for v0.1):

```typescript
// Per-agent limits
const RATE_LIMIT = {
  capacity: 10,      -- max requests
  refillRate: 1,     -- per second
  maxBurst: 20      -- absolute max
};
```

---

## Task Assignment Flow (Race Condition Fix)

```
1. Agent calls POST /task/request
2. System:
   a. Check agent has no active assignment
   b. Find random active task
   c. Create task_assignments row (locks task to agent)
   d. Return task + assignment_id + deadline

3. Agent executes task, calls POST /task/submit
   Request: {
     "assignment_id": "assign_xyz789",
     "result": { ... },
     "execution_time_ms": 1200
   }

4. System:
   a. Verify assignment belongs to agent
   b. Check deadline not expired
   c. Verify result correctness
   d. Calculate score
   e. Save to runs table
   f. Mark assignment "completed"
   g. Update agent stats (total_runs, avg_score)
```

---

## Implementation Phases

### Phase 1 — Setup + Core (4-5 hours)
- Initialize Bun project with Fastify
- Setup SQLite with schema
- Database service layer
- Error handling utilities

### Phase 2 — Auth (2-3 hours)
- Agent registration endpoint
- API key generation (secure random)
- Auth middleware (Bearer validation)
- Token verification endpoint

### Phase 3 — Task System (3-4 hours)
- Task assignment logic (race-safe)
- Task request endpoint
- Submit result endpoint
- Result verification logic

### Phase 4 — Scoring + Leaderboard (2-3 hours)
- Score calculation
- Leaderboard query (optimized)
- Agent stats endpoint

### Phase 5 — Security + Polish (2-3 hours)
- Rate limiting middleware
- Request timeout handling
- Input validation (Zod)
- Error response standardization

**Total: ~15 hours (2 days with parallel work)**

---

## V0.2 Roadmap

- Wallet integration (Tempo) — fee per run
- Redis for distributed rate limiting
- Advanced anti-cheat (behavioral analysis)
- Task difficulty tiers
- Reward distribution system

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| SQLite not Postgres | MVP simplicity, easy deploy |
| task_assignments table | Prevents race conditions without Redis |
| Denormalized agent stats | Leaderboard speed (no aggregation queries) |
| Verification methods | Flexible per-task correctness checks |
| Token bucket rate limit | Fair burst handling |

---

## Success Criteria

- Agent can register and get API key
- Agent can request task (unique assignment)
- Agent can submit and get scored
- Leaderboard shows ranked agents
- Rate limit blocks excessive requests
- Two agents can't claim same task instance
- Verification rejects incorrect results
