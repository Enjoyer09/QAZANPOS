import { Router } from "express";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, desc, sql, lt } from "drizzle-orm";
import { AuthenticatedRequest, logActivity } from "./helpers.js";

export default function activityLogRoutes(): Router {
  const router = Router();

  // GET /activity-logs - List activity logs
  router.get("/activity-logs", async (req: AuthenticatedRequest, res) => {
    try {
      const archived = req.query.archived as string;
      const date = req.query.date as string;
      const dateFrom = req.query.dateFrom as string;
      const dateTo = req.query.dateTo as string;
      const actionFilter = req.query.action as string;
      const search = req.query.search as string;

      let conditions = [eq(schema.activityLogs.tenantId, req.tenantId)];

      // Filter by archived status (default: show non-archived only)
      if (archived !== undefined) {
        conditions.push(eq(schema.activityLogs.archived, parseInt(archived)));
      } else {
        conditions.push(eq(schema.activityLogs.archived, 0));
      }

      // Filter by date prefix (ISO date match: "2024-01-15%")
      if (date) {
        conditions.push(sql`${schema.activityLogs.timestamp} LIKE ${date + "%"}`);
      }

      // Filter by date range (dateFrom / dateTo)
      if (dateFrom) {
        conditions.push(sql`${schema.activityLogs.timestamp} >= ${dateFrom + "T00:00:00.000Z"}`);
      }
      if (dateTo) {
        conditions.push(sql`${schema.activityLogs.timestamp} <= ${dateTo + "T23:59:59.999Z"}`);
      }

      // Filter by action type
      if (actionFilter) {
        conditions.push(eq(schema.activityLogs.action, actionFilter));
      }

      // Free-text search across description, username, and action
      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        conditions.push(sql`(
          ${schema.activityLogs.description} ILIKE ${term} OR
          ${schema.activityLogs.username} ILIKE ${term} OR
          ${schema.activityLogs.action} ILIKE ${term}
        )`);
      }

      const logs = await db.select().from(schema.activityLogs)
        .where(and(...conditions))
        .orderBy(desc(schema.activityLogs.timestamp));

      // Return plain array (compatible with client Logs.tsx)
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Fəaliyyət jurnalını gətirərkən xəta baş verdi" });
    }
  });

  // POST /activity-logs/archive - Archive old logs
  router.post("/activity-logs/archive", async (req: AuthenticatedRequest, res) => {
    try {
      const olderThanDays = parseInt(req.body.olderThanDays) || 90;
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

      const result = await db.update(schema.activityLogs)
        .set({ archived: 1 })
        .where(
          and(
            eq(schema.activityLogs.tenantId, req.tenantId),
            lt(schema.activityLogs.timestamp, cutoffDate),
            eq(schema.activityLogs.archived, 0)
          )
        )
        .returning({ id: schema.activityLogs.id });

      await logActivity(req, "ARCHIVE_LOGS", `${result.length} köhnə fəaliyyət qeydini arxivləşdirdi`);
      res.json({ success: true, archived: result.length });
    } catch (error) {
      res.status(500).json({ message: "Arxivləşdirmə zamanı xəta baş verdi" });
    }
  });

  return router;
}
