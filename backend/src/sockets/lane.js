import { Server } from 'socket.io';

let io;

export function initSocket(server, origins) {
  io = new Server(server, {
    cors: { origin: origins, methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join_lane', (laneId) => {
      socket.join(`lane_${laneId}`);
      console.log(`Socket ${socket.id} joined lane_${laneId}`);
    });

    socket.on('join_supervisor', () => {
      socket.join('supervisor');
      console.log(`Socket ${socket.id} joined supervisor room`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
}

export function getIO() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

export function emitLaneEvent(laneId, event, data) {
  if (!io) return;
  io.to(`lane_${laneId}`).emit(event, data);
}

export function emitSupervisorEvent(event, data) {
  if (!io) return;
  io.to('supervisor').emit(event, data);
}

export function emitGlobalEvent(event, data) {
  if (!io) return;
  io.emit(event, data);
}