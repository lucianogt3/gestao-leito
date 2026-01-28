
export enum BedStatus {
  LIVRE = 'LIVRE',
  OCUPADO = 'OCUPADO',
  HIGIENIZACAO = 'HIGIENIZACAO',
  BLOQUEADO = 'BLOQUEADO',
  RESERVADO = 'RESERVADO'
}

export type AdmissionType = 'CLINICO' | 'CIRURGICO';
export type UserRole = 'ADMIN' | 'DIRETOR';

export interface User {
  id: string;
  username: string;
  role: UserRole;
}

export interface Sector {
  id: string;
  name: string;
  code: string;
  order: number;
}

export interface Doctor {
  id: string;
  name: string;
  specialty?: string;
}

export interface Procedure {
  id: string;
  name: string;
}

export interface Bed {
  id: string;
  number: string;
  category: string; // Enfermaria, Apartamento, etc.
  status: BedStatus;
  patientName?: string;
  birthDate?: string;
  medicalRecord?: string;
  notes?: string;
  sectorId: string;
  payerId?: string;
  cidId?: string;
  procedureId?: string;
  doctorName?: string;
  admissionType?: AdmissionType;
  admissionDate?: string; 
  admissionTime?: string;
  occupiedAt?: string;
  reservedUntil?: string;
  reservationTime?: string;
  diagnosis?: string;
  entitledCategory?: string; // Categoria que o convênio autorizou
}

export interface InternmentHistory {
  id: string;
  bedId: string;
  sectorId: string;
  patientName: string;
  doctorName: string;
  admissionType: AdmissionType;
  admissionDate: string;
  releaseDate?: string;
  cidId?: string;
  payerId?: string;
  entitledCategory?: string;
}

export interface Payer {
  id: string;
  name: string;
}

export interface Cid {
  id: string;
  code: string;
  description: string;
}

export interface BedStats {
  total: number;
  livre: number;
  ocupado: number;
  higienizacao: number;
  bloqueado: number;
  reservado: number;
  occupancyRate: number;
  avgStayDays: number;
  bedTurnover: number;
  clinicoCount: number;
  cirurgicoCount: number;
  mismatchCount: number; // Quantos leitos estão com acomodação divergente
}
