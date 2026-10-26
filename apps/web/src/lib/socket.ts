import { io, type Socket } from 'socket.io-client';
import { API_ORIGIN, getToken } from './api';
let socket: Socket | null = null;
/** One shared realtime connection per browser tab; authenticated by the same HttpOnly session cookie. */
export function getSocket(): Socket {
  if (!socket) socket = io(API_ORIGIN || undefined, { withCredentials: true, auth: (cb) => cb({ token: getToken() ?? undefined }), transports: ['websocket', 'polling'], reconnectionDelayMax: 8000 });
  return socket;
}
export function closeSocket() { socket?.close(); socket = null; }
