
import { Sector, Bed, Payer, Cid, BedStatus, InternmentHistory, Doctor, Procedure } from '../types';

const STORAGE_KEYS = {
  SECTORS: 'leitos_sectors',
  BEDS: 'leitos_beds',
  PAYERS: 'leitos_payers',
  CIDS: 'leitos_cids',
  HISTORY: 'leitos_history',
  DOCTORS: 'leitos_doctors',
  PROCEDURES: 'leitos_procedures'
};

const initialProcedures: Procedure[] = [
  { id: '1', name: 'Apendicectomia' },
  { id: '2', name: 'Colecistectomia' },
  { id: '3', name: 'Angioplastia Coronária' },
  { id: '4', name: 'Artroplastia de Quadril' },
];

// Simulando latência de rede para preparar o front para chamadas assíncronas
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const DB = {
  getSectors: async (): Promise<Sector[]> => {
    await delay(100);
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SECTORS) || '[]');
  },
  getBeds: async (): Promise<Bed[]> => {
    await delay(100);
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.BEDS) || '[]');
  },
  getPayers: async (): Promise<Payer[]> => {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYERS) || '[]');
  },
  getCids: async (): Promise<Cid[]> => {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.CIDS) || '[]');
  },
  getDoctors: async (): Promise<Doctor[]> => {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.DOCTORS) || '[]');
  },
  getHistory: async (): Promise<InternmentHistory[]> => {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
  },
  getProcedures: async (): Promise<Procedure[]> => {
    const data = localStorage.getItem(STORAGE_KEYS.PROCEDURES);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.PROCEDURES, JSON.stringify(initialProcedures));
      return initialProcedures;
    }
    return JSON.parse(data);
  },

  saveBeds: async (beds: Bed[]) => {
    await delay(50);
    localStorage.setItem(STORAGE_KEYS.BEDS, JSON.stringify(beds));
  },
  saveHistory: async (history: InternmentHistory[]) => {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  },
  saveSectors: async (sectors: Sector[]) => {
    localStorage.setItem(STORAGE_KEYS.SECTORS, JSON.stringify(sectors));
  },
  savePayers: async (payers: Payer[]) => {
    localStorage.setItem(STORAGE_KEYS.PAYERS, JSON.stringify(payers));
  },
  saveCids: async (cids: Cid[]) => {
    localStorage.setItem(STORAGE_KEYS.CIDS, JSON.stringify(cids));
  },
  saveDoctors: async (doctors: Doctor[]) => {
    localStorage.setItem(STORAGE_KEYS.DOCTORS, JSON.stringify(doctors));
  },
  saveProcedures: async (p: Procedure[]) => {
    localStorage.setItem(STORAGE_KEYS.PROCEDURES, JSON.stringify(p));
  }
};
