
export enum UserRole {
  ADMIN = 'ADMIN',
  PERSONNEL = 'PERSONNEL'
}

export interface User {
  id: string;
  username: string;
  password?: string; // In a real app, never store plain text
  roles: UserRole[];
  fullName: string;
}

export interface Event {
  id: string;
  name: string;
  targetCount: number; // Hedef kişi sayısı
  currentCount: number;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'PASSIVE';
  completionDuration?: string; // "HH:MM:SS" format
  companies?: CompanyTarget[];
}

export interface CompanyTarget {
  name: string;
  count: number;
}

export interface Citizen {
  tc: string;
  name: string;
  surname: string;
  validityDate: string; // YYYY-MM-DD
}

export interface ScanEntry {
  id: string;
  eventId: string;
  citizen: Citizen;
  timestamp: string;
  recordedBy: string; // The username of the person who scanned this entry
  serverTimestamp?: number; // Added for reliable local sorting without complex indexes
}

export interface SessionState {
  isAuthenticated: boolean;
  currentUser: User | null;
}
