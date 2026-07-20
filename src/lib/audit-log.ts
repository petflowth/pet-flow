import { getSupabase } from "./supabase/server";

/** บันทึกทุก action ที่ผู้ดูแลระบบ (platform) ทำ — โดยเฉพาะ impersonate ต้องมีร่องรอยเสมอ */
export async function logAudit(entry: {
  tenantId?: string | null;
  actorType: "platform" | "tenant";
  actorId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  beforeState?: unknown;
  afterState?: unknown;
  impersonationId?: string | null;
}) {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("audit_logs").insert({
    tenant_id: entry.tenantId || null,
    actor_type: entry.actorType,
    actor_id: entry.actorId,
    action: entry.action,
    resource_type: entry.resourceType,
    resource_id: entry.resourceId || null,
    before_state: entry.beforeState ?? null,
    after_state: entry.afterState ?? null,
    impersonation_id: entry.impersonationId || null,
  });
}
