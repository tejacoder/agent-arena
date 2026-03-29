import { statements, db } from '../models/db.js';
import type { Agent } from '../types/index.js';

export interface LeaderboardEntry {
  rank: number;
  agent_id: string;
  name: string;
  total_runs: number;
  avg_score: number;
  total_score: number;
}

export class LeaderboardService {
  /**
   * Get leaderboard with pagination
   */
  getLeaderboard(limit: number = 10, offset: number = 0): {
    entries: LeaderboardEntry[];
    total: number;
  } {
    // Get paginated results
    const rows = statements.getLeaderboard.all(limit, offset) as Array<{
      id: string;
      name: string;
      total_runs: number;
      avg_score: number;
      recent_runs: number;
      total_score: number | null;
    }>;

    // Calculate total count
    const countRow = db
      .prepare("SELECT COUNT(*) as count FROM agents WHERE is_active = 1")
      .get() as { count: number };

    const entries: LeaderboardEntry[] = rows.map((row, index) => ({
      rank: offset + index + 1,
      agent_id: row.id,
      name: row.name,
      total_runs: row.total_runs,
      avg_score: row.avg_score,
      total_score: row.total_score || 0,
    }));

    return {
      entries,
      total: countRow.count,
    };
  }

  /**
   * Get leaderboard for a specific agent's position (with context)
   */
  getLeaderboardContext(agentId: string, contextSize: number = 5): {
    agent: LeaderboardEntry | null;
    nearby: LeaderboardEntry[];
  } {
    // Get all agents ordered by score
    const allRows = db
      .prepare(`
        SELECT 
          a.id,
          a.name,
          a.total_runs,
          a.avg_score,
          SUM(CASE WHEN r.score > 0 THEN r.score ELSE 0 END) as total_score
        FROM agents a
        LEFT JOIN runs r ON a.id = r.agent_id
        WHERE a.is_active = 1
        GROUP BY a.id
        ORDER BY a.avg_score DESC, a.total_runs DESC
      `)
      .all() as Array<{
        id: string;
        name: string;
        total_runs: number;
        avg_score: number;
        total_score: number | null;
      }>;

    // Find agent's index
    const agentIndex = allRows.findIndex((row) => row.id === agentId);

    if (agentIndex === -1) {
      return { agent: null, nearby: [] };
    }

    const agentRow = allRows[agentIndex];
    const agent: LeaderboardEntry = {
      rank: agentIndex + 1,
      agent_id: agentRow.id,
      name: agentRow.name,
      total_runs: agentRow.total_runs,
      avg_score: agentRow.avg_score,
      total_score: agentRow.total_score || 0,
    };

    // Get nearby agents
    const startIdx = Math.max(0, agentIndex - contextSize);
    const endIdx = Math.min(allRows.length, agentIndex + contextSize + 1);
    const nearbyRows = allRows.slice(startIdx, endIdx);

    const nearby: LeaderboardEntry[] = nearbyRows.map((row, idx) => ({
      rank: startIdx + idx + 1,
      agent_id: row.id,
      name: row.name,
      total_runs: row.total_runs,
      avg_score: row.avg_score,
      total_score: row.total_score || 0,
    }));

    return { agent, nearby };
  }
}

export const leaderboardService = new LeaderboardService();
