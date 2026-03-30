import { Router } from 'express';
import { db } from '../lib/db';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { io } from '../index';

const router = Router();

// Get comments for an email
router.get('/:emailId', authenticate, async (req: AuthRequest, res) => {
  const result = await db.query(
    `SELECT c.*, u.id as user_id, u.name as user_name, u.avatar_url as user_avatar
     FROM comments c
     JOIN users u ON u.id = c.user_id
     JOIN emails e ON e.id = c.email_id
     WHERE c.email_id = $1 AND e.workspace_id = $2
     ORDER BY c.created_at ASC`,
    [req.params.emailId, req.workspace!.id]
  );

  const comments = result.rows.map(row => ({
    ...row,
    user: { id: row.user_id, name: row.user_name, avatar_url: row.user_avatar },
  }));

  res.json(comments);
});

// Post a comment
router.post('/', authenticate, async (req: AuthRequest, res) => {
  const { email_id, body, mentions = [] } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'Body required' });

  // Verify email belongs to workspace
  const email = await db.query(
    'SELECT * FROM emails WHERE id = $1 AND workspace_id = $2',
    [email_id, req.workspace!.id]
  );
  if (!email.rows[0]) return res.status(404).json({ error: 'Email not found' });

  const result = await db.query(
    'INSERT INTO comments (email_id, user_id, body) VALUES ($1, $2, $3) RETURNING *',
    [email_id, req.user!.id, body.trim()]
  );
  const comment = result.rows[0];

  // Handle @mentions
  if (mentions.length > 0) {
    for (const mentionedUserId of mentions) {
      await db.query(
        'INSERT INTO comment_mentions (comment_id, mentioned_user_id) VALUES ($1, $2)',
        [comment.id, mentionedUserId]
      );
      if (mentionedUserId !== req.user!.id) {
        await db.query(
          `INSERT INTO notifications (user_id, type, email_id, comment_id, actor_id)
           VALUES ($1, 'mention', $2, $3, $4)`,
          [mentionedUserId, email_id, comment.id, req.user!.id]
        );
        io.to(`user:${mentionedUserId}`).emit('notification:new', {
          type: 'mention',
          email_id,
          comment_id: comment.id,
          actor: req.user,
        });
      }
    }
  }

  const enriched = {
    ...comment,
    user: { id: req.user!.id, name: req.user!.name, avatar_url: req.user!.avatar_url },
  };

  // Broadcast to workspace
  io.to(`workspace:${req.workspace!.id}`).emit('comment:new', {
    email_id,
    comment: enriched,
  });

  res.status(201).json(enriched);
});

// Edit comment
router.patch('/:id', authenticate, async (req: AuthRequest, res) => {
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'Body required' });

  const result = await db.query(
    `UPDATE comments SET body = $1, edited_at = NOW()
     WHERE id = $2 AND user_id = $3 RETURNING *`,
    [body.trim(), req.params.id, req.user!.id]
  );

  if (!result.rows[0]) return res.status(403).json({ error: 'Not allowed' });

  const comment = {
    ...result.rows[0],
    user: { id: req.user!.id, name: req.user!.name, avatar_url: req.user!.avatar_url },
  };

  io.to(`workspace:${req.workspace!.id}`).emit('comment:updated', {
    email_id: comment.email_id,
    comment,
  });

  res.json(comment);
});

// Delete comment
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  const result = await db.query(
    'DELETE FROM comments WHERE id = $1 AND user_id = $2 RETURNING *',
    [req.params.id, req.user!.id]
  );
  if (!result.rows[0]) return res.status(403).json({ error: 'Not allowed' });

  io.to(`workspace:${req.workspace!.id}`).emit('comment:deleted', {
    email_id: result.rows[0].email_id,
    comment_id: req.params.id,
  });

  res.json({ success: true });
});

export default router;
