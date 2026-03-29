import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Support env DATABASE_PATH for Render/custom paths
const DB_PATH = process.env.DATABASE_PATH || join(dirname(__dirname), '..', 'data', 'arena.db');
const DB_DIR = dirname(DB_PATH);

// Ensure data directory exists
try {
  mkdirSync(DB_DIR, { recursive: true });
} catch (err) {
  // Directory might already exist
}

// Initialize database connection
const db: Database.Database = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
function initSchema(): void {
  // Agents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      api_key_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen_at DATETIME,
      total_runs INTEGER DEFAULT 0,
      avg_score REAL DEFAULT 0,
      is_active BOOLEAN DEFAULT 1
    );
  `);

  // Tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      deadline_ms INTEGER NOT NULL,
      base_score INTEGER NOT NULL,
      verification_method TEXT NOT NULL,
      expected_result TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Task assignments table (prevents race conditions)
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_assignments (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deadline_at DATETIME NOT NULL,
      status TEXT DEFAULT 'assigned',
      FOREIGN KEY (agent_id) REFERENCES agents(id),
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );
  `);

  // Create indexes for task_assignments
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_assignments_agent ON task_assignments(agent_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_status ON task_assignments(status);
    CREATE INDEX IF NOT EXISTS idx_assignments_task ON task_assignments(task_id);
  `);

  // Runs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      assignment_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      execution_time_ms INTEGER NOT NULL,
      result_data TEXT,
      verified BOOLEAN DEFAULT 0,
      status TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agent_id) REFERENCES agents(id),
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      FOREIGN KEY (assignment_id) REFERENCES task_assignments(id)
    );
  `);

  // Create indexes for runs
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_runs_agent ON runs(agent_id);
    CREATE INDEX IF NOT EXISTS idx_runs_score ON runs(score DESC);
    CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(created_at);
  `);
}

// Initialize schema on module load
initSchema();

// Type for prepared statements
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Statement = Database.Statement<any[]>;

// Prepared statements for better performance
const statements: {
  getAgentById: Statement;
  getAgentByApiKeyHash: Statement;
  insertAgent: Statement;
  updateAgentLastSeen: Statement;
  updateAgentStats: Statement;
  getTaskById: Statement;
  getRandomActiveTask: Statement;
  insertTask: Statement;
  listTasks: Statement;
  deactivateTask: Statement;
  getActiveAssignmentByAgent: Statement;
  getAssignmentById: Statement;
  insertAssignment: Statement;
  updateAssignmentStatus: Statement;
  expireOldAssignments: Statement;
  insertRun: Statement;
  getRunsByAgent: Statement;
  getLeaderboard: Statement;
} = {
  // Agent queries
  getAgentById: db.prepare('SELECT * FROM agents WHERE id = ?'),
  getAgentByApiKeyHash: db.prepare('SELECT * FROM agents WHERE api_key_hash = ?'),
  insertAgent: db.prepare(`
    INSERT INTO agents (id, name, api_key_hash, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `),
  updateAgentLastSeen: db.prepare(`
    UPDATE agents SET last_seen_at = datetime('now') WHERE id = ?
  `),
  updateAgentStats: db.prepare(`
    UPDATE agents 
    SET total_runs = ?, avg_score = ?
    WHERE id = ?
  `),

  // Task queries
  getTaskById: db.prepare('SELECT * FROM tasks WHERE id = ? AND is_active = 1'),
  getRandomActiveTask: db.prepare(`
    SELECT * FROM tasks 
    WHERE is_active = 1 
    ORDER BY RANDOM() 
    LIMIT 1
  `),
  insertTask: db.prepare(`
    INSERT INTO tasks (id, type, payload, deadline_ms, base_score, verification_method, expected_result)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  listTasks: db.prepare('SELECT * FROM tasks ORDER BY created_at DESC'),
  deactivateTask: db.prepare('UPDATE tasks SET is_active = 0 WHERE id = ?'),

  // Task assignment queries
  getActiveAssignmentByAgent: db.prepare(`
    SELECT * FROM task_assignments 
    WHERE agent_id = ? AND status = 'assigned'
    ORDER BY assigned_at DESC
    LIMIT 1
  `),
  getAssignmentById: db.prepare('SELECT * FROM task_assignments WHERE id = ?'),
  insertAssignment: db.prepare(`
    INSERT INTO task_assignments (id, agent_id, task_id, assigned_at, deadline_at, status)
    VALUES (?, ?, ?, datetime('now'), datetime(?, 'unixepoch'), 'assigned')
  `),
  updateAssignmentStatus: db.prepare(`
    UPDATE task_assignments 
    SET status = ?
    WHERE id = ?
  `),
  expireOldAssignments: db.prepare(`
    UPDATE task_assignments 
    SET status = 'expired'
    WHERE status = 'assigned' AND deadline_at < datetime('now')
  `),

  // Run queries
  insertRun: db.prepare(`
    INSERT INTO runs (id, agent_id, task_id, assignment_id, score, execution_time_ms, result_data, verified, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getRunsByAgent: db.prepare(`
    SELECT * FROM runs WHERE agent_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
  `),
  getLeaderboard: db.prepare(`
    SELECT 
      a.id,
      a.name,
      a.total_runs,
      a.avg_score,
      COUNT(r.id) as recent_runs,
      SUM(CASE WHEN r.score > 0 THEN r.score ELSE 0 END) as total_score
    FROM agents a
    LEFT JOIN runs r ON a.id = r.agent_id
    WHERE a.is_active = 1
    GROUP BY a.id
    ORDER BY a.avg_score DESC, a.total_runs DESC
    LIMIT ? OFFSET ?
  `),
};

export { db, statements, initSchema };
export default db;
