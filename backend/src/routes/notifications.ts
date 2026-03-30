import { Router } from 'express';
import { db } from '../lib/db';
import { authenticate, AuthRequest } from '../middleware/authenticate';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  const result = await db.query(
    `SELECT n.*,
      u.name as actor_name, u.avatar_url as actor_avatar,
      e.subject as email_subject, e.from_address as email_from
     FROM notifications n
     LEFT JOIN users u ON u.id = n.actor_id
     LEFT JOIN emails e ON e.id = n.email_id
     WHERE n.user_id = $1
     ORDER BY n.created_at DESC
     LIMIT 50`,
    [req.user!.id]
  );
  res.json(result.rows);
});

router.patch('/read-all', authenticate, async (req: AuthRequest, res) => {
  await db.query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.user!.id]);
  res.json({ success: true });
});

router.patch('/:id/read', authenticate, async (req: AuthRequest, res) => {
  await db.query(
    'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user!.id]
  );
  res.json({ success: true });
});

export default router;
