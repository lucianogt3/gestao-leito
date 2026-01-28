
import { BedStatus, Bed, InternmentHistory, AuditLog } from '../types';

const DB_KEYS = {
  SECTORS: 'be_sectors',
  BEDS: 'be_beds',
  PAYERS: 'be_payers',
  CIDS: 'be_cids',
  HISTORY: 'be_history',
  DOCTORS: 'be_doctors',
  PROCEDURES: 'be_procedures',
  AUDIT: 'be_audit'
};

export const Server = {
  async handleRequest(method: string, route: string, body?: any): Promise<any> {
    // Simula processamento de servidor com latência variável
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));
    const db = this.getDB();
    const actor = body?.actor || 'SISTEMA';

    // ROTEAMENTO DE SETORES
    if (route === '/sectors' && method === 'GET') return db.sectors;
    if (route === '/sectors' && method === 'POST') {
      const sector = { ...body, id: Math.random().toString(36).substr(2, 9) };
      db.sectors.push(sector);
      this.saveDB(db);
      return sector;
    }

    // ROTEAMENTO DE LEITOS
    if (route === '/beds' && method === 'GET') return db.beds;
    
    // ATUALIZAÇÃO DE STATUS (Lógica de Alta e Limpeza)
    if (route.endsWith('/status') && method === 'PATCH') {
      const id = route.split('/')[2];
      const bedIndex = db.beds.findIndex((b: any) => b.id === id);
      if (bedIndex !== -1) {
        const bed = db.beds[bedIndex];
        const oldStatus = bed.status;
        const nextStatus = body.status;

        // Se sair de OCUPADO para HIGIENIZACAO, marca alta no histórico
        if (oldStatus === BedStatus.OCUPADO && nextStatus === BedStatus.HIGIENIZACAO) {
           const historyIdx = [...db.history].reverse().findIndex((h: InternmentHistory) => h.bedId === bed.id && !h.releaseDate);
           if (historyIdx !== -1) {
             const actualIdx = db.history.length - 1 - historyIdx;
             db.history[actualIdx].releaseDate = new Date().toISOString();
           }
           this.logAudit(db, 'DISCHARGE', bed.number, actor, `Alta registrada para o paciente ${bed.patientName}.`);
        }

        // Se o leito for liberado (LIVRE), apaga dados sensíveis
        if (nextStatus === BedStatus.LIVRE) {
           this.clearBedPatientData(bed);
           this.logAudit(db, 'CLEAN_COMPLETE', bed.number, actor, `Higienização finalizada. Leito disponível.`);
        } else if (nextStatus === BedStatus.BLOQUEADO) {
           this.logAudit(db, 'BLOCKED', bed.number, actor, `Leito bloqueado para manutenção.`);
        }

        bed.status = nextStatus;
        this.saveDB(db);
        return bed;
      }
    }

    // ADMISSÃO (OCUPAR LEITO)
    if (route.endsWith('/occupy') && method === 'POST') {
      const id = route.split('/')[2];
      const bedIndex = db.beds.findIndex((b: any) => b.id === id);
      if (bedIndex !== -1) {
        const bed = db.beds[bedIndex];
        const admissionData = body.data;

        // Atualiza o leito
        const updatedBed = { 
          ...bed, 
          ...admissionData, 
          status: BedStatus.OCUPADO, 
          occupiedAt: new Date().toISOString() 
        };
        db.beds[bedIndex] = updatedBed;

        // Cria entrada no histórico
        const historyEntry: InternmentHistory = {
          id: Math.random().toString(36).substr(2, 9),
          bedId: updatedBed.id,
          sectorId: updatedBed.sectorId,
          patientName: updatedBed.patientName,
          doctorName: updatedBed.doctorName,
          admissionType: updatedBed.admissionType,
          admissionDate: updatedBed.admissionDate,
          entitledCategory: updatedBed.entitledCategory,
          payerId: updatedBed.payerId,
          cidId: updatedBed.cidId
        };
        db.history.push(historyEntry);

        this.logAudit(db, 'ADMISSION', updatedBed.number, actor, `Paciente ${updatedBed.patientName} admitido via NIR.`);
        this.saveDB(db);
        return updatedBed;
      }
    }

    // LISTAS AUXILIARES
    if (route === '/doctors' && method === 'GET') return db.doctors;
    if (route === '/history' && method === 'GET') return db.history;
    if (route === '/audit' && method === 'GET') return db.audit;
    if (route === '/payers' && method === 'GET') return db.payers;
    if (route === '/cids' && method === 'GET') return db.cids;
    if (route === '/procedures' && method === 'GET') return db.procedures;

    throw new Error("Route not found");
  },

  getDB() {
    const getData = (key: string) => JSON.parse(localStorage.getItem(key) || '[]');
    return {
      sectors: getData(DB_KEYS.SECTORS),
      beds: getData(DB_KEYS.BEDS),
      payers: getData(DB_KEYS.PAYERS),
      cids: getData(DB_KEYS.CIDS),
      history: getData(DB_KEYS.HISTORY),
      doctors: getData(DB_KEYS.DOCTORS),
      procedures: getData(DB_KEYS.PROCEDURES),
      audit: getData(DB_KEYS.AUDIT)
    };
  },

  saveDB(db: any) {
    localStorage.setItem(DB_KEYS.SECTORS, JSON.stringify(db.sectors));
    localStorage.setItem(DB_KEYS.BEDS, JSON.stringify(db.beds));
    localStorage.setItem(DB_KEYS.PAYERS, JSON.stringify(db.payers));
    localStorage.setItem(DB_KEYS.CIDS, JSON.stringify(db.cids));
    localStorage.setItem(DB_KEYS.HISTORY, JSON.stringify(db.history));
    localStorage.setItem(DB_KEYS.DOCTORS, JSON.stringify(db.doctors));
    localStorage.setItem(DB_KEYS.PROCEDURES, JSON.stringify(db.procedures));
    localStorage.setItem(DB_KEYS.AUDIT, JSON.stringify(db.audit));
  },

  logAudit(db: any, action: string, bedNumber: string, user: string, details: string) {
    const log: AuditLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      action,
      bedNumber,
      user,
      details
    };
    db.audit.unshift(log);
    if (db.audit.length > 300) db.audit.pop();
  },

  clearBedPatientData(bed: Bed) {
    delete bed.patientName;
    delete bed.birthDate;
    delete bed.doctorName;
    delete bed.payerId;
    delete bed.cidId;
    delete bed.procedureId;
    delete bed.admissionType;
    delete bed.admissionDate;
    delete bed.admissionTime;
    delete bed.occupiedAt;
    delete bed.entitledCategory;
    delete bed.diagnosis;
  }
};
