import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupSocketHandlers } from './socket';
import authRoutes from './routes/auth';
import emailRoutes from './routes/emails';
import assignmentRoutes from './routes/assignments';
import commentRoutes from './routes/comments';
import replyRoutes from './routes/replies';
import notificationRoutes from './routes/notifications';
import webhookRoutes from './routes/webhook';
import { startWorkers } from './workers';

const app = express();
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Raw body for webhook signature verification
app.use('/gmail/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/replies', replyRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/gmail', webhookRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// WebSocket
setupSocketHandlers(io);

// Start background workers
startWorkers();

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`MailDesk backend running on port ${PORT}`);
});

export default app;
