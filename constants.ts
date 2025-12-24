
import { Citizen, Event, User, UserRole } from './types';

// Mock "Database" simulating the Google Sheet
// Columns: TC, Ad, Soyad, Geçerlilik Tarihi
export const MOCK_CITIZEN_DB: Citizen[] = [
  { tc: "11111111111", name: "Ahmet", surname: "Yılmaz", validityDate: "2025-12-31" },
  { tc: "22222222222", name: "Ayşe", surname: "Demir", validityDate: "2024-06-30" },
  { tc: "33333333333", name: "Mehmet", surname: "Kaya", validityDate: "2025-01-01" },
  { tc: "44444444444", name: "Fatma", surname: "Çelik", validityDate: "2023-12-12" }, // Expired example
  { tc: "55555555555", name: "Mustafa", surname: "Şahin", validityDate: "2026-05-20" },
  { tc: "12345678901", name: "Test", surname: "Kullanıcı", validityDate: "2030-01-01" },
];

export const INITIAL_USERS: User[] = [
  { id: '1', username: 'admin', password: 'admin123', roles: [UserRole.ADMIN, UserRole.PERSONNEL], fullName: 'Yönetici' },
  { id: '2', username: '441288', password: '441288', roles: [UserRole.PERSONNEL], fullName: '441288' },
  { id: '3', username: 'rgurses', password: 'rgurses9', roles: [UserRole.ADMIN, UserRole.PERSONNEL], fullName: 'Rıfat Gürses' },
];

export const INITIAL_EVENTS: Event[] = [];
