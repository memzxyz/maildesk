import { Router } from 'express';
import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import { db } from '../lib/db';
import { registerGmailWatch } from '../services/gmail';

const router = Router();

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// Step 1: Redirect to Google OAuth
router.get('/google', (req, res) => {
  const { workspaceSlug, inviteToken } = req.query;
  const oauth2Client = getOAuthClient();

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
    ],
    state: JSON.stringify({ workspaceSlug, inviteToken }),
  });

  res.redirect(url);
});

// Step 2: Handle callback from Google
router.get('/google/callback', async (req, res) => {
  const { code, state } = req.query;
  const { workspaceSlug, inviteToken } = state ? JSON.parse(state as string) : {};

  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: googleUser } = await oauth2.userinfo.get();

    const { email, name, picture, id: googleId } = googleUser;

    // Find or create workspace
    let workspace;
    if (workspaceSlug) {
      const ws = await db.query('SELECT * FROM workspaces WHERE slug = $1', [workspaceSlug]);
      workspace = ws.rows[0];
    }

    if (!workspace) {
      // Create a new workspace from the user's email domain
      const domain = email!.split('@')[1];
      const slug = domain.replace(/\./g, '-') + '-' + Date.now();
      const ws = await db.query(
        'INSERT INTO workspaces (name, slug) VALUES ($1, $2) RETURNING *',
        [domain, slug]
      );
      workspace = ws.rows[0];
    }

    // Find or create user
    let user;
    const existingUser = await db.query(
      'SELECT * FROM users WHERE google_id = $1',
      [googleId]
    );

    if (existingUser.rows[0]) {
      user = existingUser.rows[0];
    } else {
      const newUser = await db.query(
        `INSERT INTO users (workspace_id, email, name, avatar_url, google_id, role)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [workspace.id, email, name, picture, googleId, 'owner']
      );
      user = newUser.rows[0];
    }

    // Store Gmail tokens (encrypted in real app — simplified here)
    await db.query(
      `INSERT INTO gmail_accounts (workspace_id, user_id, gmail_address, access_token, refresh_token, token_expiry)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (workspace_id, gmail_address) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         token_expiry = EXCLUDED.token_expiry`,
      [
        workspace.id,
        user.id,
        email,
        tokens.access_token,
        tokens.refresh_token,
        tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      ]
    );

    // Register Gmail push notifications
    const gmailAccount = await db.query(
      'SELECT * FROM gmail_accounts WHERE workspace_id = $1 AND gmail_address = $2',
      [workspace.id, email]
    );
    if (gmailAccount.rows[0]) {
      await registerGmailWatch(gmailAccount.rows[0], tokens);
    }

    // Issue JWT
    const jwtToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '30d' });

    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${jwtToken}&workspace=${workspace.slug}`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
  }
});

// Get current user
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const result = await db.query(
      `SELECT u.*, w.name as workspace_name, w.slug as workspace_slug
       FROM users u JOIN workspaces w ON w.id = u.workspace_id
       WHERE u.id = $1`,
      [payload.userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Get team members
router.get('/team', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const user = await db.query('SELECT * FROM users WHERE id = $1', [payload.userId]);
    if (!user.rows[0]) return res.status(401).json({ error: 'Not found' });

    const team = await db.query(
      'SELECT id, name, email, avatar_url, role FROM users WHERE workspace_id = $1 ORDER BY name',
      [user.rows[0].workspace_id]
    );
    res.json(team.rows);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
