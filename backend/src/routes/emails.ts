import { Router } from 'express';
import { db } from '../lib/db';
import { authenticate, AuthRequest } from '../middleware/authenticate';

const router = Router();

// List emails with assignment + comment count
router.get('/', authenticate, async (req: AuthRequest, res) => {
  const { status = 'open', assignee, page = '1', limit = '30' } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  let query = `
    SELECT
      e.*,
      u.id as assignee_id, u.name as assignee_name, u.avatar_url as assignee_avatar,
      COUNT(DISTINCT c.id)::int as comment_count
    FROM emails e
    LEFT JOIN email_assignments ea ON ea.email_id = e.id
    LEFT JOIN users u ON u.id = ea.assigned_to
    LEFT JOIN comments c ON c.email_id = e.id
    WHERE e.workspace_id = $1
  `;
  const params: any[] = [req.workspace!.id];
  let paramIdx = 2;

  if (status && status !== 'all') {
    query += ` AND e.status = $${paramIdx++}`;
    params.push(status);
  }
  if (assignee) {
    query += ` AND ea.assigned_to = $${paramIdx++}`;
    params.push(assignee);
  }

  query += ` GROUP BY e.id, u.id ORDER BY e.received_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
  params.push(parseInt(limit as string), offset);

  const result = await db.query(query, params);

  const emails = result.rows.map(row => ({
    ...row,
    assigned_to: row.assignee_id ? {
      id: row.assignee_id,
      name: row.assignee_name,
      avatar_url: row.assignee_avatar,
    } : null,
  }));

  res.json(emails);
});

// Get single email
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  const result = await db.query(
    `SELECT e.*,
      u.id as assignee_id, u.name as assignee_name, u.email as assignee_email, u.avatar_url as assignee_avatar
     FROM emails e
     LEFT JOIN email_assignments ea ON ea.email_id = e.id
     LEFT JOIN users u ON u.id = ea.assigned_to
     WHERE e.id = $1 AND e.workspace_id = $2`,
    [req.params.id, req.workspace!.id]
  );

  if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });

  // Mark as read
  await db.query('UPDATE emails SET is_read = true WHERE id = $1', [req.params.id]);

  const row = result.rows[0];
  res.json({
    ...row,
    assigned_to: row.assignee_id ? {
      id: row.assignee_id,
      name: row.assignee_name,
      email: row.assignee_email,
      avatar_url: row.assignee_avatar,
    } : null,
  });
});

// Update email status
router.patch('/:id/status', authenticate, async (req: AuthRequest, res) => {
  const { status } = req.body;
  if (!['open', 'resolved', 'snoozed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const result = await db.query(
    'UPDATE emails SET status = $1 WHERE id = $2 AND workspace_id = $3 RETURNING *',
    [status, req.params.id, req.workspace!.id]
  );

  if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

export default router;
