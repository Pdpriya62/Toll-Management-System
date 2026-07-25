export async function logAudit(client, entityType, entityId, action, oldData, newData, userId) {
  await client.query(
    `INSERT INTO audit_log (entity_type, entity_id, action, old_data, new_data, user_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [entityType, entityId, action, oldData ? JSON.stringify(oldData) : null, newData ? JSON.stringify(newData) : null, userId]
  );
}

export async function getAuditLog(entityType, entityId) {
  const { query } = await import('../config/db.js');
  const result = await query(
    `SELECT al.*, u.username FROM audit_log al
     LEFT JOIN users u ON al.user_id = u.id
     WHERE al.entity_type = $1 AND al.entity_id = $2
     ORDER BY al.created_at DESC`,
    [entityType, entityId]
  );
  return result.rows;
}