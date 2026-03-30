import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { db } from './lib/db';

export function setupSocketHandlers(io: Server) {
  // Auth middleware for sockets
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('No token'));

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      const user = await db.query(
        'SELECT u.*, w.id as workspace_id FROM users u JOIN workspaces w ON w.id = u.workspace_id WHERE u.id = $1',
        [payload.userId]
      );
      if (!user.rows[0]) return next(new Error('User not found'));
      socket.data.user = user.rows[0];
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    console.log(`Socket connected: ${user.email}`);

    // Join workspace room and personal room
    socket.join(`workspace:${user.workspace_id}`);
    socket.join(`user:${user.id}`);

    // Join specific email room for live comment updates
    socket.on('email:join', (emailId: string) => {
      socket.join(`email:${emailId}`);
    });

    socket.on('email:leave', (emailId: string) => {
      socket.leave(`email:${emailId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${user.email}`);
    });
  });
}
