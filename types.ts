export interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: Date;
  isAi?: boolean;
}

export interface User {
  id: string;
  peerId?: string; // Trystero Peer ID
  name: string;
  isLocal: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
}

export enum RoomState {
  LOBBY = 'LOBBY',
  JOINING = 'JOINING',
  ACTIVE = 'ACTIVE'
}

export interface StreamConfig {
  url: string;
  type: 'youtube' | 'direct' | 'embed';
}