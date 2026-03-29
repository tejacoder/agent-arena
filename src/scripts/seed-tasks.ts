import { initSchema } from '../models/db.js';
import { taskService } from '../services/taskService.js';

// Sample tasks for the arena
const sampleTasks = [
  {
    type: 'fetch' as const,
    payload: {
      url: 'https://api.example.com/data',
      count: 3,
      description: 'Fetch data from API and return count of items',
    },
    deadline_ms: 5000,
    base_score: 1000,
    verification_method: 'contains' as const,
    expected_result: { count: 3 },
  },
  {
    type: 'compute' as const,
    payload: {
      operation: 'sum',
      numbers: [1, 2, 3, 4, 5],
      description: 'Calculate the sum of the provided numbers',
    },
    deadline_ms: 2000,
    base_score: 1000,
    verification_method: 'exact_match' as const,
    expected_result: 15,
  },
  {
    type: 'compute' as const,
    payload: {
      operation: 'factorial',
      n: 5,
      description: 'Calculate factorial of n',
    },
    deadline_ms: 3000,
    base_score: 1500,
    verification_method: 'exact_match' as const,
    expected_result: 120,
  },
  {
    type: 'validate' as const,
    payload: {
      data: [10, 20, 30, 40, 50],
      description: 'Validate all numbers are within range 0-100',
    },
    deadline_ms: 1500,
    base_score: 800,
    verification_method: 'contains' as const,
    expected_result: { valid: true },
  },
  {
    type: 'compute' as const,
    payload: {
      operation: 'fibonacci',
      n: 10,
      description: 'Calculate the nth Fibonacci number',
    },
    deadline_ms: 4000,
    base_score: 1200,
    verification_method: 'exact_match' as const,
    expected_result: 55,
  },
];

async function seedTasks() {
  console.log('Initializing database...');
  initSchema();

  console.log('Seeding sample tasks...');

  for (const taskData of sampleTasks) {
    try {
      const task = taskService.createTask(taskData);
      console.log(`Created task: ${task.id} (${task.type})`);
    } catch (error) {
      console.error(`Failed to create task:`, error);
    }
  }

  console.log('Seeding complete!');
  console.log(`\nYou can now:`);
  console.log(`1. Start the server: bun run dev`);
  console.log(`2. Register an agent: POST /agent/register`);
  console.log(`3. Request a task: POST /task/request`);
}

seedTasks().catch(console.error);
