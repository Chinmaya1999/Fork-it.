import type { Server } from 'socket.io';
let io: Server | undefined;
export const setIO = (s: Server) => { io = s; };
export const getIO = () => io;
export const emitToUser = (userId: string, event: string, payload: unknown) => { io?.to(`user:${userId}`).emit(event, payload); };
export const emitToStaff = (event: string, payload: unknown) => { io?.to('staff').emit(event, payload); };
export const emitToRoom = (room: string, event: string, payload: unknown) => { io?.to(room).emit(event, payload); };
export const isUserOnline = async (userId: string) => !!io && (await io.in(`user:${userId}`).fetchSockets()).length > 0;
