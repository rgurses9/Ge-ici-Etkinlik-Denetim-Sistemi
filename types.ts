
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
  lastActive?: number; // Added for tracking online presence
}

export interface AccreditationPersonnel {
  sn: string;
  sicili: string;
  tcKimlik: string;
  adi: string;
  rutbesi: string;
  dogumTarihi: string;
  cepTel: string;
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
  userCounts?: Record<string, number>; // Added for efficient dashboard display without fetching all scans
  companyCounts?: Record<string, number>; // Added for efficient multi-company dashboard display
  companyUserCounts?: Record<string, number>; // Added for company-specific user stats (Format: Company_User)
  accreditationTarget?: number;
  accreditationPersonnel?: AccreditationPersonnel[];
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
  companyName?: string; // Which company this scan belongs to
  serverTimestamp?: number; // Added for reliable local sorting without complex indexes
}

export interface SessionState {
  isAuthenticated: boolean;
  currentUser: User | null;
}
