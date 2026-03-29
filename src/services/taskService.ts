import { statements, db } from '../models/db.js';
import { generateId } from '../utils/crypto.js';
import {
  NotFoundError,
  ConflictError,
  TaskAssignmentError,
} from '../utils/errors.js';
import type {
  Task,
  TaskRow,
  CreateTaskInput,
  TaskAssignment,
  TaskAssignmentRow,
} from '../types/index.js';

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    type: row.type as Task['type'],
    payload: JSON.parse(row.payload),
    deadline_ms: row.deadline_ms,
    base_score: row.base_score,
    verification_method: row.verification_method as Task['verification_method'],
    expected_result: row.expected_result ? JSON.parse(row.expected_result) : undefined,
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
  };
}

function rowToAssignment(row: TaskAssignmentRow): TaskAssignment {
  return {
    id: row.id,
    agent_id: row.agent_id,
    task_id: row.task_id,
    assigned_at: row.assigned_at,
    deadline_at: row.deadline_at,
    status: row.status as TaskAssignment['status'],
  };
}

export interface TaskWithAssignment {
  task: Task;
  assignment: TaskAssignment;
  deadline_at: string;
}

export class TaskService {
  /**
   * Get a task by ID
   */
  getTaskById(id: string): Task | null {
    const row = statements.getTaskById.get(id) as TaskRow | undefined;
    if (!row) return null;
    return rowToTask(row);
  }

  /**
   * List all active tasks
   */
  listTasks(): Task[] {
    const rows = statements.listTasks.all() as TaskRow[];
    return rows
      .filter((row) => row.is_active)
      .map(rowToTask);
  }

  /**
   * Create a new task (admin only)
   */
  createTask(input: CreateTaskInput): Task {
    const id = generateId('task');

    statements.insertTask.run(
      id,
      input.type,
      JSON.stringify(input.payload),
      input.deadline_ms,
      input.base_score,
      input.verification_method,
      input.expected_result !== undefined
        ? JSON.stringify(input.expected_result)
        : null
    );

    const row = db
      .prepare('SELECT * FROM tasks WHERE id = ?')
      .get(id) as TaskRow;

    return rowToTask(row);
  }

  /**
   * Deactivate a task (admin only)
   */
  deactivateTask(id: string): void {
    const result = statements.deactivateTask.run(id);
    if (result.changes === 0) {
      throw new NotFoundError('Task', id);
    }
  }

  /**
   * Request a task assignment for an agent
   * Uses task_assignments table to prevent race conditions
   */
  requestTaskAssignment(agentId: string): TaskWithAssignment {
    // First, expire any old assignments
    statements.expireOldAssignments.run();

    // Check if agent already has an active assignment
    const existingAssignment = statements.getActiveAssignmentByAgent.get(
      agentId
    ) as TaskAssignmentRow | undefined;

    if (existingAssignment) {
      const task = this.getTaskById(existingAssignment.task_id);
      if (task) {
        throw new ConflictError(
          `Agent already has an active assignment: ${existingAssignment.id} for task ${task.id}`
        );
      }
    }

    // Get a random active task
    const taskRow = statements.getRandomActiveTask.get() as TaskRow | undefined;
    if (!taskRow) {
      throw new TaskAssignmentError('No tasks available at this time');
    }

    const task = rowToTask(taskRow);

    // Create assignment within a transaction to ensure atomicity
    const assignTaskTransaction = db.transaction(() => {
      const assignmentId = generateId('assign');
      const deadlineTimestamp = Math.floor(Date.now() / 1000) + task.deadline_ms / 1000;

      // Insert the assignment
      statements.insertAssignment.run(
        assignmentId,
        agentId,
        task.id,
        deadlineTimestamp
      );

      // Verify the assignment was created
      const assignmentRow = statements.getAssignmentById.get(
        assignmentId
      ) as TaskAssignmentRow | undefined;

      if (!assignmentRow) {
        throw new TaskAssignmentError('Failed to create assignment');
      }

      return rowToAssignment(assignmentRow);
    });

    const assignment = assignTaskTransaction();

    return {
      task,
      assignment,
      deadline_at: assignment.deadline_at,
    };
  }

  /**
   * Get assignment by ID
   */
  getAssignmentById(id: string): TaskAssignment | null {
    const row = statements.getAssignmentById.get(id) as TaskAssignmentRow | undefined;
    if (!row) return null;
    return rowToAssignment(row);
  }

  /**
   * Update assignment status
   */
  updateAssignmentStatus(
    assignmentId: string,
    status: TaskAssignment['status']
  ): void {
    const result = statements.updateAssignmentStatus.run(status, assignmentId);
    if (result.changes === 0) {
      throw new NotFoundError('Assignment', assignmentId);
    }
  }

  /**
   * Check if assignment is expired
   */
  isAssignmentExpired(assignment: TaskAssignment): boolean {
    const now = new Date();
    const deadline = new Date(assignment.deadline_at);
    return now > deadline;
  }
}

export const taskService = new TaskService();
