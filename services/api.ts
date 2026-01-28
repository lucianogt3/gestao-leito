
import { Server } from '../backend/server';
import { Bed, Sector, BedStatus } from '../types';

// Helper para obter o usuário logado (simulado)
const getActor = () => {
  const userStr = localStorage.getItem('current_user');
  if (userStr) {
    const user = JSON.parse(userStr);
    return user.username;
  }
  return 'SISTEMA';
};

export const ApiService = {
  sectors: {
    getAll: () => Server.handleRequest('GET', '/sectors'),
    create: (data: Partial<Sector>) => Server.handleRequest('POST', '/sectors', { ...data, actor: getActor() })
  },
  beds: {
    getAll: () => Server.handleRequest('GET', '/beds'),
    create: (data: Partial<Bed>) => Server.handleRequest('POST', '/beds', { ...data, actor: getActor() }),
    updateStatus: (id: string, status: BedStatus) => Server.handleRequest('PATCH', `/beds/${id}/status`, { status, actor: getActor() }),
    occupy: (id: string, data: any) => Server.handleRequest('POST', `/beds/${id}/occupy`, { data, actor: getActor() })
  },
  doctors: {
    getAll: () => Server.handleRequest('GET', '/doctors')
  },
  history: {
    getAll: () => Server.handleRequest('GET', '/history')
  },
  audit: {
    getAll: () => Server.handleRequest('GET', '/audit')
  },
  payers: {
    getAll: () => Server.handleRequest('GET', '/payers')
  },
  cids: {
    getAll: () => Server.handleRequest('GET', '/cids')
  },
  procedures: {
    getAll: () => Server.handleRequest('GET', '/procedures')
  }
};
