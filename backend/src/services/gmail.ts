import { google } from 'googleapis';
import { db } from '../lib/db';
import { io } from '../index';

export function getOAuthClientForAccount(account: any) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  auth.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expiry_date: account.token_expiry ? new Date(account.token_expiry).getTime() : undefined,
  });

  // Auto-refresh handler
  auth.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await db.query(
        `UPDATE gmail_accounts SET access_token = $1, token_expiry = $2 WHERE id = $3`,
        [tokens.access_token, tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null, account.id]
      );
    }
  });

  return auth;
}

export async function registerGmailWatch(account: any, tokens: any) {
  try {
    const auth = getOAuthClientForAccount({ ...account, ...tokens });
    const gmail = google.gmail({ version: 'v1', auth });

    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: process.env.GOOGLE_PUBSUB_TOPIC,
        labelIds: ['INBOX'],
      },
    });

    await db.query(
      `UPDATE gmail_accounts SET
        history_id = $1,
        watch_expiry = $2
       WHERE id = $3`,
      [
        response.data.historyId,
        response.data.expiration ? new Date(parseInt(response.data.expiration)).toISOString() : null,
        account.id,
      ]
    );

    console.log(`Gmail watch registered for ${account.gmail_address}`);
  } catch (err) {
    console.error('Failed to register Gmail watch:', err);
  }
}

export async function syncEmailsForAccount(accountId: string, newHistoryId?: string) {
  const accountResult = await db.query('SELECT * FROM gmail_accounts WHERE id = $1', [accountId]);
  if (!accountResult.rows[0]) return;
  const account = accountResult.rows[0];

  const auth = getOAuthClientForAccount(account);
  const gmail = google.gmail({ version: 'v1', auth });

  try {
    if (account.history_id && newHistoryId) {
      // Incremental sync via history
      const history = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: account.history_id,
        historyTypes: ['messageAdded'],
        labelId: 'INBOX',
      });

      const messages = history.data.history?.flatMap(h => h.messagesAdded?.map(m => m.message) || []) || [];

      for (const msg of messages) {
        if (msg?.id) {
          await fetchAndStoreMessage(gmail, account, msg.id);
        }
      }

      // Update history id
      if (newHistoryId) {
        await db.query('UPDATE gmail_accounts SET history_id = $1 WHERE id = $2', [newHistoryId, accountId]);
      }
    } else {
      // Full sync — fetch last 50 messages
      const list = await gmail.users.messages.list({
        userId: 'me',
        labelIds: ['INBOX'],
        maxResults: 50,
      });

      for (const msg of list.data.messages || []) {
        await fetchAndStoreMessage(gmail, account, msg.id!);
      }

      // Store history id
      const profile = await gmail.users.getProfile({ userId: 'me' });
      await db.query('UPDATE gmail_accounts SET history_id = $1 WHERE id = $2', [profile.data.historyId, accountId]);
    }
  } catch (err) {
    console.error(`Sync error for account ${accountId}:`, err);
  }
}

async function fetchAndStoreMessage(gmail: any, account: any, messageId: string) {
  try {
    // Check if already stored
    const existing = await db.query(
      'SELECT id FROM emails WHERE gmail_message_id = $1 AND workspace_id = $2',
      [messageId, account.workspace_id]
    );
    if (existing.rows[0]) return;

    const msg = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const { payload, snippet, threadId, internalDate } = msg.data;
    const headers = payload.headers || [];

    const getHeader = (name: string) =>
      headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const subject = getHeader('Subject');
    const fromRaw = getHeader('From');
    const toRaw = getHeader('To');
    const fromMatch = fromRaw.match(/^(.*?)\s*<(.+?)>$/) || [null, null, fromRaw];
    const fromName = fromMatch[1]?.trim() || null;
    const fromAddress = fromMatch[2]?.trim() || fromRaw;

    // Extract body
    let bodyHtml = '';
    let bodyText = '';

    function extractBody(part: any) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      if (part.parts) part.parts.forEach(extractBody);
    }
    extractBody(payload);

    const result = await db.query(
      `INSERT INTO emails (
        workspace_id, gmail_account_id, gmail_message_id, gmail_thread_id,
        subject, from_address, from_name, snippet,
        body_html, body_text, received_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (workspace_id, gmail_message_id) DO NOTHING
      RETURNING *`,
      [
        account.workspace_id,
        account.id,
        messageId,
        threadId,
        subject,
        fromAddress,
        fromName,
        snippet,
        bodyHtml,
        bodyText,
        new Date(parseInt(internalDate)).toISOString(),
      ]
    );

    if (result.rows[0]) {
      // Broadcast new email to workspace
      io.to(`workspace:${account.workspace_id}`).emit('email:new', result.rows[0]);
    }
  } catch (err) {
    console.error(`Error fetching message ${messageId}:`, err);
  }
}
