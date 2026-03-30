import { Router } from 'express';
import { google } from 'googleapis';
import { db } from '../lib/db';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { getOAuthClientForAccount } from '../services/gmail';

const router = Router();

// Send a reply via Gmail
router.post('/', authenticate, async (req: AuthRequest, res) => {
  const { email_id, body_html } = req.body;
  if (!body_html?.trim()) return res.status(400).json({ error: 'Body required' });

  // Get email + gmail account
  const emailResult = await db.query(
    `SELECT e.*, ga.access_token, ga.refresh_token, ga.token_expiry, ga.gmail_address
     FROM emails e
     JOIN gmail_accounts ga ON ga.id = e.gmail_account_id
     WHERE e.id = $1 AND e.workspace_id = $2`,
    [email_id, req.workspace!.id]
  );

  if (!emailResult.rows[0]) return res.status(404).json({ error: 'Email not found' });
  const email = emailResult.rows[0];

  try {
    const auth = await getOAuthClientForAccount(email);
    const gmail = google.gmail({ version: 'v1', auth });

    // Build RFC 2822 message
    const rawMessage = buildReplyMessage({
      to: email.from_address,
      from: email.gmail_address,
      subject: `Re: ${email.subject || ''}`,
      body: body_html,
      threadId: email.gmail_thread_id,
      inReplyTo: email.gmail_message_id,
    });

    const sent = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawMessage,
        threadId: email.gmail_thread_id,
      },
    });

    // Store reply record
    await db.query(
      `INSERT INTO email_replies (email_id, sent_by, gmail_message_id, body_html)
       VALUES ($1, $2, $3, $4)`,
      [email_id, req.user!.id, sent.data.id, body_html]
    );

    res.json({ success: true, gmail_message_id: sent.data.id });
  } catch (err: any) {
    console.error('Reply error:', err);
    res.status(500).json({ error: err.message });
  }
});

function buildReplyMessage({ to, from, subject, body, threadId, inReplyTo }: any) {
  const messageParts = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `In-Reply-To: ${inReplyTo}`,
    `References: ${inReplyTo}`,
    `Content-Type: text/html; charset=utf-8`,
    `MIME-Version: 1.0`,
    '',
    body,
  ];

  const message = messageParts.join('\r\n');
  return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default router;
