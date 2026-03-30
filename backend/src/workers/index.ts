import { Queue, Worker } from 'bullmq';
import { syncEmailsForAccount } from '../services/gmail';
import { db } from '../lib/db';

const redisConnection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
};

// Queue for email syncing
export const emailSyncQueue = new Queue('email-sync', {
  connection: { host: new URL(process.env.REDIS_URL || 'redis://localhost:6379').hostname },
});

export function startWorkers() {
  // Email sync worker
  const syncWorker = new Worker(
    'email-sync',
    async (job) => {
      const { accountId, historyId } = job.data;
      await syncEmailsForAccount(accountId, historyId);
    },
    {
      connection: { host: new URL(process.env.REDIS_URL || 'redis://localhost:6379').hostname },
      concurrency: 3,
    }
  );

  syncWorker.on('failed', (job, err) => {
    console.error(`Sync job ${job?.id} failed:`, err);
  });

  // Initial sync for all accounts on startup
  initialSync();

  // Re-register Gmail watches daily (they expire every 7 days)
  setInterval(renewGmailWatches, 24 * 60 * 60 * 1000);

  console.log('Workers started');
}

async function initialSync() {
  try {
    const accounts = await db.query('SELECT * FROM gmail_accounts');
    for (const account of accounts.rows) {
      await emailSyncQueue.add('initial-sync', { accountId: account.id });
    }
  } catch (err) {
    console.error('Initial sync error:', err);
  }
}

async function renewGmailWatches() {
  try {
    // Find accounts whose watch expires in the next 24 hours
    const accounts = await db.query(
      `SELECT * FROM gmail_accounts
       WHERE watch_expiry < NOW() + INTERVAL '24 hours'
       OR watch_expiry IS NULL`
    );

    const { registerGmailWatch } = await import('../services/gmail');
    for (const account of accounts.rows) {
      await registerGmailWatch(account, {
        access_token: account.access_token,
        refresh_token: account.refresh_token,
      });
    }
  } catch (err) {
    console.error('Watch renewal error:', err);
  }
}
