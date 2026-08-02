import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export function SocketProvider({ children, user }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) return;
    const s = io(API_BASE, { transports: ['websocket', 'polling'], autoConnect: true });
    s.on('connect', () => { setConnected(true); console.log('Socket connected'); });
    s.on('disconnect', () => setConnected(false));
    setSocket(s);
    return () => s.close();
  }, [user]);

  const joinLane = useCallback((laneId) => { socket?.emit('join_lane', laneId); }, [socket]);
  const joinSupervisor = useCallback(() => { socket?.emit('join_supervisor'); }, [socket]);
  const onTransactionCreated = useCallback((cb) => { socket?.on('transaction_created', cb); return () => socket?.off('transaction_created', cb); }, [socket]);
  const onTransactionUpdated = useCallback((cb) => { socket?.on('transaction_updated', cb); return () => socket?.off('transaction_updated', cb); }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, connected, joinLane, joinSupervisor, onTransactionCreated, onTransactionUpdated }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}