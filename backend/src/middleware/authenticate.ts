import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../lib/db';

export interface AuthRequest extends Request {
  user?: any;
  workspace?: any;
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const result = await db.query(
      `SELECT u.*, w.id as w_id, w.name as w_name, w.slug as w_slug
       FROM users u
       JOIN workspaces w ON w.id = u.workspace_id
       WHERE u.id = $1`,
      [payload.userId]
    );
    if (!result.rows[0]) return res.status(401).json({ error: 'User not found' });

    const row = result.rows[0];
    req.user = {
      id: row.id,
      email: row.email,
      name: row.name,
      avatar_url: row.avatar_url,
      role: row.role,
      workspace_id: row.workspace_id,
    };
    req.workspace = {
      id: row.w_id,
      name: row.w_name,
      slug: row.w_slug,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
