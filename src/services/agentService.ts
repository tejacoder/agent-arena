import { statements, db } from '../models/db.js';
import {
  generateApiKey,
  hashApiKey,
  verifyApiKey,
  generateId,
} from '../utils/crypto.js';
import { NotFoundError, UnauthorizedError } from '../utils/errors.js';
import type { Agent, AgentRow, RegisterAgentInput } from '../types/index.js';

export interface AgentWithKey extends Agent {
  api_key: string; // Plaintext key (only returned on registration)
}

function rowToAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    name: row.name,
    api_key_hash: row.api_key_hash,
    created_at: row.created_at,
    last_seen_at: row.last_seen_at,
    total_runs: row.total_runs,
    avg_score: row.avg_score,
    is_active: Boolean(row.is_active),
  };
}

export class AgentService {
  /**
   * Register a new agent and return agent info with plaintext API key
   */
  async registerAgent(input: RegisterAgentInput): Promise<AgentWithKey> {
    const id = generateId('agent');
    const apiKey = generateApiKey();
    const apiKeyHash = await hashApiKey(apiKey);

    try {
      statements.insertAgent.run(id, input.name, apiKeyHash);

      const row = statements.getAgentById.get(id) as AgentRow | undefined;
      if (!row) {
        throw new Error('Failed to create agent');
      }

      return {
        ...rowToAgent(row),
        api_key: apiKey, // Return plaintext key ONCE
      };
    } catch (error) {
      // Check for unique constraint violations if we add them later
      throw error;
    }
  }

  /**
   * Get agent by ID
   */
  getAgentById(id: string): Agent | null {
    const row = statements.getAgentById.get(id) as AgentRow | undefined;
    if (!row) return null;
    return rowToAgent(row);
  }

  /**
   * Verify API key and return agent if valid
   */
  async verifyApiKey(apiKey: string): Promise<Agent | null> {
    // Note: We can't query by hash directly since bcrypt produces different hashes each time
    // We need to iterate through active agents and compare
    // For production, consider caching or using a different approach
    const rows = db
      .prepare("SELECT * FROM agents WHERE is_active = 1")
      .all() as AgentRow[];

    for (const row of rows) {
      const isValid = await verifyApiKey(apiKey, row.api_key_hash);
      if (isValid) {
        // Update last seen
        statements.updateAgentLastSeen.run(row.id);
        return rowToAgent(row);
      }
    }

    return null;
  }

  /**
   * Update agent stats after a completed run
   */
  updateAgentStats(agentId: string, newRunScore: number): void {
    const agent = this.getAgentById(agentId);
    if (!agent) {
      throw new NotFoundError('Agent', agentId);
    }

    const totalRuns = agent.total_runs + 1;
    // Calculate new average: ((old_avg * old_count) + new_score) / new_count
    const newAvgScore =
      (agent.avg_score * agent.total_runs + newRunScore) / totalRuns;

    statements.updateAgentStats.run(totalRuns, newAvgScore, agentId);
  }

  /**
   * List all active agents
   */
  listAgents(): Agent[] {
    const rows = db
      .prepare("SELECT * FROM agents WHERE is_active = 1 ORDER BY avg_score DESC")
      .all() as AgentRow[];
    return rows.map(rowToAgent);
  }
}

export const agentService = new AgentService();
