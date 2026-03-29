import { statements, db } from '../models/db.js';
import { generateId } from '../utils/crypto.js';
import { calculateScore, verifyResult } from '../utils/scoring.js';
import {
  NotFoundError,
  ForbiddenError,
  TaskAssignmentError,
  VerificationError,
} from '../utils/errors.js';
import { agentService } from './agentService.js';
import { taskService } from './taskService.js';
import type {
  Run,
  RunRow,
  SubmitTaskInput,
  Task,
  TaskAssignment,
} from '../types/index.js';

function rowToRun(row: RunRow): Run {
  return {
    id: row.id,
    agent_id: row.agent_id,
    task_id: row.task_id,
    assignment_id: row.assignment_id,
    score: row.score,
    execution_time_ms: row.execution_time_ms,
    result_data: row.result_data ? JSON.parse(row.result_data) : undefined,
    verified: Boolean(row.verified),
    status: row.status as Run['status'],
    created_at: row.created_at,
  };
}

export interface SubmissionResult {
  run: Run;
  score: number;
  verified: boolean;
  speed_factor: number;
}

export class RunService {
  /**
   * Submit task result and create a run record
   */
  submitTaskResult(
    agentId: string,
    input: SubmitTaskInput
  ): SubmissionResult {
    // Get the assignment
    const assignment = taskService.getAssignmentById(input.assignment_id);
    if (!assignment) {
      throw new NotFoundError('Assignment', input.assignment_id);
    }

    // Verify assignment belongs to agent
    if (assignment.agent_id !== agentId) {
      throw new ForbiddenError('Assignment does not belong to this agent');
    }

    // Check if already completed or expired
    if (assignment.status !== 'assigned') {
      throw new TaskAssignmentError(
        `Assignment is already ${assignment.status}`
      );
    }

    // Check if expired
    const isExpired = taskService.isAssignmentExpired(assignment);
    if (isExpired) {
      taskService.updateAssignmentStatus(input.assignment_id, 'expired');
      throw new TaskAssignmentError('Assignment deadline has expired');
    }

    // Get the task
    const task = taskService.getTaskById(assignment.task_id);
    if (!task) {
      throw new NotFoundError('Task', assignment.task_id);
    }

    // Verify the result
    const isVerified = verifyResult(
      input.result,
      task.expected_result,
      task.verification_method
    );

    // Calculate score
    const score = calculateScore(
      task.base_score,
      task.deadline_ms,
      input.execution_time_ms,
      isVerified
    );

    // Determine run status
    let status: Run['status'] = 'completed';
    if (!isVerified) {
      status = 'failed';
    } else if (input.execution_time_ms > task.deadline_ms) {
      status = 'expired';
    }

    // Create run record within a transaction
    const createRunTransaction = db.transaction(() => {
      const runId = generateId('run');

      // Insert run
      statements.insertRun.run(
        runId,
        agentId,
        task.id,
        assignment.id,
        score,
        input.execution_time_ms,
        JSON.stringify(input.result),
        isVerified ? 1 : 0,
        status
      );

      // Update assignment status
      taskService.updateAssignmentStatus(
        assignment.id,
        status === 'completed' ? 'completed' : 'expired'
      );

      // Update agent stats
      agentService.updateAgentStats(agentId, score);

      // Return the created run
      const row = db
        .prepare('SELECT * FROM runs WHERE id = ?')
        .get(runId) as RunRow;

      return rowToRun(row);
    });

    const run = createRunTransaction();

    // Calculate speed factor for response
    const speedFactor =
      isVerified && input.execution_time_ms <= task.deadline_ms
        ? task.deadline_ms / input.execution_time_ms
        : 0;

    return {
      run,
      score,
      verified: isVerified,
      speed_factor: Math.min(speedFactor, 2.0),
    };
  }

  /**
   * Get runs for an agent
   */
  getAgentRuns(agentId: string, limit: number = 10, offset: number = 0): Run[] {
    const rows = statements.getRunsByAgent.all(agentId, limit, offset) as RunRow[];
    return rows.map(rowToRun);
  }

  /**
   * Get a single run by ID
   */
  getRunById(id: string): Run | null {
    const row = db
      .prepare('SELECT * FROM runs WHERE id = ?')
      .get(id) as RunRow | undefined;
    if (!row) return null;
    return rowToRun(row);
  }
}

export const runService = new RunService();
