import { Pool } from "pg";
export type AuditAction = 'create'|'update'|'delete'|'export'|'login';
export interface AuditInput {
  action: AuditAction;
  table: string;
  rowPk: Record<string, any>;
  before?: any;
  after?: any;
  actorUserId?: number | null;
  actorEmail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}
export async function logAudit(pool: Pool, a: AuditInput) {
  await pool.query(
    `INSERT INTO audit_log (action, table_name, row_pk, before, after, actor_user_id, actor_email, ip, user_agent, request_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      a.action, a.table, JSON.stringify(a.rowPk),
      a.before ? JSON.stringify(a.before) : null,
      a.after ? JSON.stringify(a.after) : null,
      a.actorUserId ?? null, a.actorEmail ?? null,
      a.ip ?? null, a.userAgent ?? null, a.requestId ?? null
    ]
  );
}
export function getReqMeta(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip"))?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  const requestId = (globalThis.crypto as any)?.randomUUID?.() ?? require("node:crypto").randomUUID();
  return { ip, userAgent, requestId } as const;
}

