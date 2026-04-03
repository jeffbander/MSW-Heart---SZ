import { supabase } from './supabase';
import { AppUser } from './auth';

/**
 * Fire-and-forget audit log entry.
 * Call after successful mutations — does not block the response.
 */
export function logAudit(
  user: AppUser,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {}
): void {
  supabase
    .from('audit_log')
    .insert({
      user_id: user.id,
      user_display_name: user.display_name,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    })
    .then(({ error }) => {
      if (error) {
        console.error('[audit] Failed to log:', error.message, { action, entityType, entityId });
      }
    });
}
