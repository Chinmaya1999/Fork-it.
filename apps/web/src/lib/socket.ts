import { io, type Socket } from 'socket.io-client';
let socket: Socket | null = null;
/** One shared realtime connection per browser tab; authenticated by the same HttpOnly session cookie. */
export function getSocket(): Socket {
  if (!socket) socket = io({ withCredentials: true, transports: ['websocket', 'polling'], reconnectionDelayMax: 8000 });
  return socket;
}
export function closeSocket() { socket?.close(); socket = null; }
