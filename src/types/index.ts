import { z } from 'zod';

// Agent types
export const AgentSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  api_key_hash: z.string(),
  created_at: z.string().datetime().optional(),
  last_seen_at: z.string().datetime().nullable().optional(),
  total_runs: z.number().int().default(0),
  avg_score: z.number().default(0),
  is_active: z.boolean().default(true),
});

export const RegisterAgentSchema = z.object({
  name: z.string().min(1).max(100),
});

export type Agent = z.infer<typeof AgentSchema>;
export type RegisterAgentInput = z.infer<typeof RegisterAgentSchema>;

// Task types
export const TaskTypeSchema = z.enum(['fetch', 'compute', 'validate']);
export const VerificationMethodSchema = z.enum(['exact_match', 'contains', 'range']);

export const TaskSchema = z.object({
  id: z.string(),
  type: TaskTypeSchema,
  payload: z.record(z.any()),
  deadline_ms: z.number().int().positive(),
  base_score: z.number().int().positive(),
  verification_method: VerificationMethodSchema,
  expected_result: z.any().optional(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime().optional(),
});

export const CreateTaskSchema = z.object({
  type: TaskTypeSchema,
  payload: z.record(z.any()),
  deadline_ms: z.number().int().positive(),
  base_score: z.number().int().positive().default(1000),
  verification_method: VerificationMethodSchema,
  expected_result: z.any().optional(),
});

export type Task = z.infer<typeof TaskSchema>;
export type TaskType = z.infer<typeof TaskTypeSchema>;
export type VerificationMethod = z.infer<typeof VerificationMethodSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

// Task Assignment types
export const AssignmentStatusSchema = z.enum(['assigned', 'completed', 'expired']);

export const TaskAssignmentSchema = z.object({
  id: z.string(),
  agent_id: z.string(),
  task_id: z.string(),
  assigned_at: z.string().datetime(),
  deadline_at: z.string().datetime(),
  status: AssignmentStatusSchema,
});

export type AssignmentStatus = z.infer<typeof AssignmentStatusSchema>;
export type TaskAssignment = z.infer<typeof TaskAssignmentSchema>;

// Run types
export const RunStatusSchema = z.enum(['pending', 'completed', 'failed', 'expired']);

export const RunSchema = z.object({
  id: z.string(),
  agent_id: z.string(),
  task_id: z.string(),
  assignment_id: z.string(),
  score: z.number().int(),
  execution_time_ms: z.number().int(),
  result_data: z.any().optional(),
  verified: z.boolean(),
  status: RunStatusSchema,
  created_at: z.string().datetime().optional(),
});

export const SubmitTaskSchema = z.object({
  assignment_id: z.string(),
  result: z.any(),
  execution_time_ms: z.number().int().positive(),
});

export type RunStatus = z.infer<typeof RunStatusSchema>;
export type Run = z.infer<typeof RunSchema>;
export type SubmitTaskInput = z.infer<typeof SubmitTaskSchema>;

// Leaderboard types
export const LeaderboardQuerySchema = z.object({
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).default('10'),
  offset: z.string().transform(Number).pipe(z.number().int().nonnegative()).default('0'),
});

export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>;

// Auth types
export const AuthHeadersSchema = z.object({
  authorization: z.string().regex(/^Bearer\s.+$/, 'Authorization must be Bearer token'),
  'x-agent-id': z.string(),
});

export type AuthHeaders = z.infer<typeof AuthHeadersSchema>;

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// Database row types (for internal use)
export interface AgentRow {
  id: string;
  name: string;
  api_key_hash: string;
  created_at: string;
  last_seen_at: string | null;
  total_runs: number;
  avg_score: number;
  is_active: number;
}

export interface TaskRow {
  id: string;
  type: string;
  payload: string;
  deadline_ms: number;
  base_score: number;
  verification_method: string;
  expected_result: string | null;
  is_active: number;
  created_at: string;
}

export interface TaskAssignmentRow {
  id: string;
  agent_id: string;
  task_id: string;
  assigned_at: string;
  deadline_at: string;
  status: string;
}

export interface RunRow {
  id: string;
  agent_id: string;
  task_id: string;
  assignment_id: string;
  score: number;
  execution_time_ms: number;
  result_data: string | null;
  verified: number;
  status: string;
  created_at: string;
}
