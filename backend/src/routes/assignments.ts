import { Router } from 'express';
import { db } from '../lib/db';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { io } from '../index';

const router = Router();

// Assign or reassign email
router.post('/', authenticate, async (req: AuthRequest, res) => {
  const { email_id, assigned_to } = req.body;

  // Verify email belongs to workspace
  const email = await db.query(
    'SELECT * FROM emails WHERE id = $1 AND workspace_id = $2',
    [email_id, req.workspace!.id]
  );
  if (!email.rows[0]) return res.status(404).json({ error: 'Email not found' });

  // Remove existing assignment
  await db.query('DELETE FROM email_assignments WHERE email_id = $1', [email_id]);

  let assignment = null;
  if (assigned_to) {
    const result = await db.query(
      `INSERT INTO email_assignments (email_id, assigned_to, assigned_by)
       VALUES ($1, $2, $3) RETURNING *`,
      [email_id, assigned_to, req.user!.id]
    );
    assignment = result.rows[0];

    // Create notification for assignee (if not self-assigning)
    if (assigned_to !== req.user!.id) {
      await db.query(
        `INSERT INTO notifications (user_id, type, email_id, actor_id)
         VALUES ($1, 'assignment', $2, $3)`,
        [assigned_to, email_id, req.user!.id]
      );
    }
  }

  // Get assignee details for response
  let assignee = null;
  if (assigned_to) {
    const u = await db.query('SELECT id, name, email, avatar_url FROM users WHERE id = $1', [assigned_to]);
    assignee = u.rows[0];
  }

  // Broadcast to workspace via socket
  io.to(`workspace:${req.workspace!.id}`).emit('email:assigned', {
    email_id,
    assigned_to: assignee,
    assigned_by: req.user,
  });

  // Also notify assignee's personal room
  if (assigned_to) {
    io.to(`user:${assigned_to}`).emit('notification:new', {
      type: 'assignment',
      email_id,
      actor: req.user,
    });
  }

  res.json({ assignment, assigned_to: assignee });
});

// Remove assignment
router.delete('/:emailId', authenticate, async (req: AuthRequest, res) => {
  await db.query(
    `DELETE FROM email_assignments ea
     USING emails e
     WHERE ea.email_id = e.id AND ea.email_id = $1 AND e.workspace_id = $2`,
    [req.params.emailId, req.workspace!.id]
  );

  io.to(`workspace:${req.workspace!.id}`).emit('email:assigned', {
    email_id: req.params.emailId,
    assigned_to: null,
  });

  res.json({ success: true });
});

export default router;
