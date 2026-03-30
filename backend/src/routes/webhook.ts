import { Router } from 'express';
import { db } from '../lib/db';
import { syncEmailsForAccount } from '../services/gmail';
import { emailSyncQueue } from '../workers';

const router = Router();

// Gmail Pub/Sub push endpoint
router.post('/webhook', async (req, res) => {
  // Acknowledge immediately to avoid Pub/Sub retries
  res.status(200).send('OK');

  try {
    const body = JSON.parse(req.body.toString());
    if (!body.message?.data) return;

    const data = JSON.parse(Buffer.from(body.message.data, 'base64').toString());
    const { emailAddress, historyId } = data;

    if (!emailAddress || !historyId) return;

    // Find the gmail account
    const account = await db.query(
      'SELECT * FROM gmail_accounts WHERE gmail_address = $1',
      [emailAddress]
    );

    if (!account.rows[0]) return;

    // Queue a sync job
    await emailSyncQueue.add('sync', {
      accountId: account.rows[0].id,
      historyId: historyId.toString(),
    });
  } catch (err) {
    console.error('Webhook error:', err);
  }
});

export default router;
