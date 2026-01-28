
import React, { useState, useEffect, useMemo } from 'react';
import { Bed, Sector, BedStatus, Payer, Cid, AdmissionType, InternmentHistory, Doctor, User, Procedure, AuditLog } from './types';
import { ApiService } from './services/api';
import { STATUS_CONFIG } from './constants';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, Legend
} from 'recharts';

const THEME = {
  glass: "bg-white/90 backdrop-blur-2xl border border-white shadow-2xl shadow-slate-200/60",
  card: "bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1",
  input: "w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 transition-all outline-none font-bold text-slate-700 placeholder:text-slate-300",
  btnPrimary: "bg-emerald-800 hover:bg-emerald-900 text-white px-8 py-4 rounded-xl font-black shadow-xl shadow-emerald-200 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50",
  btnSecondary: "bg-slate-100 hover:bg-slate-200 text-slate-600 px-8 py-4 rounded-xl font-black active:scale-95 transition-all flex items-center justify-center gap-2",
  label: "text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block ml-1"
};

const BED_CATEGORIES = ['Enfermaria', 'Apartamento', 'Suite', 'Master', 'UTI', 'Emergência'];

const calculateAge = (birthDate?: string) => {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

// Normalização profissional de formulário
const normalizeOccupyPayload = (fd: FormData) => {
  const obj = Object.fromEntries(fd.entries());
  return {
    patientName: String(obj.patientName || '').trim(),
    birthDate: String(obj.birthDate || ''),
    payerId: String(obj.payerId || ''),
    entitledCategory: String(obj.entitledCategory || ''),
    cidId: String(obj.cidId || ''),
    admissionType: String(obj.admissionType || 'CLINICO') as AdmissionType,
    doctorName: String(obj.doctorName || ''),
    admissionDate: String(obj.admissionDate || new Date().toISOString().split('T')[0])
  };
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('current_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'SETTINGS' | 'KPI' | 'AUDIT'>('DASHBOARD');
  const [settingsTab, setSettingsTab] = useState<'SECTORS' | 'DOCTORS' | 'PAYERS' | 'CIDS' | 'PROCEDURES'>('SECTORS');

  const [sectors, setSectors] = useState<Sector[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [payers, setPayers] = useState<Payer[]>([]);
  const [cids, setCids] = useState<Cid[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [history, setHistory] = useState<InternmentHistory[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  
  const [activeSectorId, setActiveSectorId] = useState<string | null>(null);
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);
  const [loading, setLoading] = useState(true);

  const [isOccupyModalOpen, setIsOccupyModalOpen] = useState(false);
  const [isBedActionModalOpen, setIsBedActionModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, b, p, c, d, pr, h, a] = await Promise.all([
        ApiService.sectors.getAll(), ApiService.beds.getAll(), 
        ApiService.payers.getAll(), ApiService.cids.getAll(), 
        ApiService.doctors.getAll(), ApiService.procedures.getAll(), 
        ApiService.history.getAll(), ApiService.audit.getAll()
      ]);
      setSectors(s); setBeds(b); setPayers(p); setCids(c); 
      setDoctors(d); setProcedures(pr); setHistory(h); setAuditLogs(a);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = beds.length;
    const ocupados = beds.filter(b => b.status === BedStatus.OCUPADO).length;
    const occupancyRate = total > 0 ? (ocupados / total) * 100 : 0;
    const turnover = total > 0 ? history.length / total : 0;

    // Tempo médio de permanência (LOS - Length of Stay)
    const historyWithRelease = history.filter(h => h.releaseDate);
    const avgStay = historyWithRelease.length > 0 
      ? historyWithRelease.reduce((acc, curr) => {
          const stay = (new Date(curr.releaseDate!).getTime() - new Date(curr.admissionDate).getTime()) / (1000 * 60 * 60 * 24);
          return acc + stay;
        }, 0) / historyWithRelease.length
      : 0;

    return {
      total, ocupados, occupancyRate,
      bedTurnover: turnover,
      avgStay: avgStay.toFixed(1)
    };
  }, [beds, history]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const user = fd.get('user') as string;
    const newUser: User = user === 'admin' 
      ? { id: '1', username: 'Administrador', role: 'ADMIN' }
      : { id: '2', username: 'Operador', role: 'DIRETOR' };
    
    localStorage.setItem('current_user', JSON.stringify(newUser));
    setCurrentUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('current_user');
    setCurrentUser(null);
  };

  const handleOccupyBed = async (payload: any) => {
    if (!selectedBed) return;
    setLoading(true);
    try {
      await ApiService.beds.occupy(selectedBed.id, payload);
      await loadData();
      setIsOccupyModalOpen(false);
      setSelectedBed(null);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBedStatus = async (bedId: string, nextStatus: BedStatus) => {
    setLoading(true);
    try {
      await ApiService.beds.updateStatus(bedId, nextStatus);
      await loadData();
      setIsBedActionModalOpen(false);
      setSelectedBed(null);
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) return (
    <div className="min-h-screen bg-emerald-950 flex items-center justify-center p-6">
      <div className="bg-white rounded-[3rem] p-16 shadow-2xl w-full max-w-lg">
        <h1 className="text-4xl font-black text-emerald-950 text-center mb-4 tracking-tighter">BEM T CARE</h1>
        <p className="text-center text-slate-400 font-bold uppercase text-[10px] mb-12 tracking-widest">Hospital Management System</p>
        <form onSubmit={handleLogin} className="space-y-6">
          <input name="user" required className={THEME.input} placeholder="Usuário (admin ou op)" />
          <input type="password" required className={THEME.input} placeholder="Senha" />
          <button className="w-full h-16 bg-emerald-800 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-900/20 active:scale-95 transition-all">ACESSAR PAINEL</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8faf9] flex flex-col">
      <header className="bg-emerald-950 px-10 py-5 flex justify-between items-center shadow-2xl z-50 sticky top-0">
        <div className="flex items-center gap-4">
           <div className="bg-emerald-800 p-3 rounded-xl shadow-lg"><i className="fa-solid fa-hospital-user text-white"></i></div>
           <h1 className="text-xl font-black text-white tracking-tighter">BEM T CARE <span className="text-emerald-400">PRO</span></h1>
        </div>
        <nav className="flex bg-white/5 p-1 rounded-2xl">
          {[
            { id: 'DASHBOARD', label: 'Mapa' },
            { id: 'KPI', label: 'Indicadores' },
            { id: 'AUDIT', label: 'Auditoria' },
            { id: 'SETTINGS', label: 'Gestão' }
          ].map(tab => (
            (tab.id !== 'SETTINGS' || currentUser.role === 'ADMIN') && (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === tab.id ? 'bg-white text-emerald-950 shadow-lg' : 'text-white/40 hover:text-white'}`}>
                {tab.label}
              </button>
            )
          ))}
        </nav>
        <div className="flex items-center gap-6">
           <div className="text-right"><p className="text-[10px] font-black text-emerald-400 uppercase leading-none">{currentUser.username}</p><p className="text-[9px] text-white/30 font-bold">{currentUser.role}</p></div>
           <button onClick={handleLogout} className="w-10 h-10 rounded-xl bg-white/5 text-emerald-400 hover:bg-rose-500 hover:text-white transition-all"><i className="fa-solid fa-power-off"></i></button>
        </div>
      </header>

      {loading && (
        <div className="fixed bottom-10 right-10 bg-white border-2 border-emerald-800 p-6 rounded-[2rem] shadow-2xl z-[500] flex items-center gap-4 animate-in slide-in-from-bottom-10">
          <div className="w-5 h-5 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-900">Processando Transação...</p>
        </div>
      )}

      <main className="flex-1 p-12 max-w-[1920px] mx-auto w-full">
        {activeTab === 'DASHBOARD' && (
          <div className="space-y-10">
             <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black text-emerald-950 tracking-tighter">Mapa de Leitos</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dados atualizados em tempo real pelo servidor</p>
                </div>
                <select value={activeSectorId || ''} onChange={e => setActiveSectorId(e.target.value || null)} className="bg-white border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-black uppercase outline-none shadow-sm focus:border-emerald-600 transition-all">
                  <option value="">Todos os Setores</option>
                  {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
                {beds.filter(b => !activeSectorId || b.sectorId === activeSectorId).map(bed => (
                  <BedCard key={bed.id} bed={bed} onClick={() => { setSelectedBed(bed); setIsBedActionModalOpen(true); }} />
                ))}
             </div>
          </div>
        )}

        {activeTab === 'AUDIT' && (
          <div className="bg-white rounded-[3rem] p-12 shadow-xl border border-slate-100">
             <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-black text-emerald-950">Rastro de Auditoria</h2>
                <button onClick={loadData} className="text-[10px] font-black text-emerald-700 uppercase border border-emerald-100 px-4 py-2 rounded-xl hover:bg-emerald-50"><i className="fa-solid fa-sync mr-2"></i>Atualizar</button>
             </div>
             <div className="space-y-4">
                {auditLogs.map(log => (
                  <div key={log.id} className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100 flex justify-between items-center hover:bg-white hover:shadow-md transition-all group">
                     <div className="flex gap-6 items-center">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all"><i className="fa-solid fa-shield-halved"></i></div>
                        <div>
                           <div className="flex items-center gap-3">
                              <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full uppercase">{log.action}</span>
                              <span className="text-sm font-bold text-slate-800">{log.details}</span>
                           </div>
                           <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Leito {log.bedNumber} • Realizado por <span className="text-emerald-900">{log.user}</span></p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-[12px] font-black text-emerald-950">{new Date(log.timestamp).toLocaleTimeString()}</p>
                        <p className="text-[9px] text-slate-300 font-bold uppercase">{new Date(log.timestamp).toLocaleDateString()}</p>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'KPI' && (
          <div className="space-y-12">
             <h2 className="text-3xl font-black text-emerald-950">Inteligência de Gestão</h2>
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <KPICard title="Ocupação Geral" value={`${stats.occupancyRate.toFixed(1)}%`} sub="Capacidade da Planta" icon="fa-chart-pie" color="text-emerald-700" bg="bg-emerald-50" />
                <KPICard title="Giro de Leitos" value={stats.bedTurnover.toFixed(2)} sub="Altas/Capacidade" icon="fa-rotate" color="text-blue-600" bg="bg-blue-50" />
                <KPICard title="Permanência (LOS)" value={`${stats.avgStay}d`} sub="Tempo Médio" icon="fa-hourglass-half" color="text-amber-600" bg="bg-amber-50" />
                <KPICard title="Altas do Período" value={history.filter(h => h.releaseDate).length} sub="Pacientes Liberados" icon="fa-house-user" color="text-indigo-600" bg="bg-indigo-50" />
             </div>
          </div>
        )}
      </main>

      {/* MODALS REFINADOS */}
      <Modal isOpen={isBedActionModalOpen && !!selectedBed} onClose={() => setIsBedActionModalOpen(false)} title={`Gestão do Leito: ${selectedBed?.number}`}>
         {selectedBed && (
           <div className="space-y-8">
              <div className={`p-8 rounded-[2rem] ${STATUS_CONFIG[selectedBed.status].bg} ${STATUS_CONFIG[selectedBed.status].color} flex items-center gap-6 shadow-inner`}>
                 <div className="text-4xl">{STATUS_CONFIG[selectedBed.status].icon}</div>
                 <div><p className="text-[10px] font-black uppercase opacity-60 tracking-widest">{selectedBed.category}</p><h4 className="text-3xl font-black">{STATUS_CONFIG[selectedBed.status].label}</h4></div>
              </div>
              
              {selectedBed.status === BedStatus.LIVRE ? (
                <div className="grid grid-cols-1 gap-4">
                   <button onClick={() => { setIsOccupyModalOpen(true); setIsBedActionModalOpen(false); }} className="w-full h-24 bg-emerald-800 text-white rounded-3xl font-black text-xl shadow-xl shadow-emerald-900/10 hover:bg-emerald-900 active:scale-95 transition-all flex items-center justify-center gap-4"><i className="fa-solid fa-user-plus"></i>INTERNAR PACIENTE</button>
                   <button onClick={() => handleUpdateBedStatus(selectedBed.id, BedStatus.BLOQUEADO)} className="w-full h-16 bg-slate-100 text-slate-500 rounded-2xl font-black hover:bg-slate-200 transition-all">BLOQUEAR PARA MANUTENÇÃO</button>
                </div>
              ) : selectedBed.status === BedStatus.OCUPADO ? (
                <div className="space-y-6">
                   <div className="p-10 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                      <p className={THEME.label}>Paciente em Atendimento</p>
                      <p className="font-black text-emerald-950 text-2xl uppercase mb-4">{selectedBed.patientName}</p>
                      <div className="flex gap-4">
                         <div className="px-3 py-1 bg-white rounded-lg border text-[10px] font-black text-slate-400">ADM: {selectedBed.admissionDate}</div>
                         <div className="px-3 py-1 bg-white rounded-lg border text-[10px] font-black text-emerald-600">DR: {selectedBed.doctorName}</div>
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => handleUpdateBedStatus(selectedBed.id, BedStatus.HIGIENIZACAO)} className="h-20 bg-amber-500 text-white rounded-3xl font-black text-lg shadow-xl shadow-amber-900/10 hover:bg-amber-600 active:scale-95 transition-all">ALTA / LIMPEZA</button>
                      <button className="h-20 bg-indigo-600 text-white rounded-3xl font-black text-lg shadow-xl shadow-indigo-900/10 hover:bg-indigo-700 active:scale-95 transition-all">TRANSFERÊNCIA</button>
                   </div>
                </div>
              ) : selectedBed.status === BedStatus.HIGIENIZACAO ? (
                 <div className="space-y-6 text-center">
                    <div className="p-10 bg-amber-50/50 rounded-[2.5rem] border border-amber-100 flex flex-col items-center gap-4">
                       <i className="fa-solid fa-soap text-5xl text-amber-300 animate-pulse"></i>
                       <p className="font-black text-amber-800 uppercase text-[12px] tracking-widest">Aguardando Conclusão da Higienização</p>
                    </div>
                    <button onClick={() => handleUpdateBedStatus(selectedBed.id, BedStatus.LIVRE)} className="w-full h-20 bg-emerald-800 text-white rounded-3xl font-black text-lg">LIBERAR PARA USO</button>
                 </div>
              ) : (
                <button onClick={() => handleUpdateBedStatus(selectedBed.id, BedStatus.LIVRE)} className="w-full h-20 bg-emerald-800 text-white rounded-3xl font-black text-lg">DESBLOQUEAR LEITO</button>
              )}
           </div>
         )}
      </Modal>

      <Modal isOpen={isOccupyModalOpen} onClose={() => setIsOccupyModalOpen(false)} title="Admissão de Paciente" maxWidth="max-w-4xl">
         <form onSubmit={e => { e.preventDefault(); handleOccupyBed(normalizeOccupyPayload(new FormData(e.currentTarget))); }} className="grid grid-cols-2 gap-8">
            <div className="col-span-2"><label className={THEME.label}>Nome Completo</label><input name="patientName" required className={THEME.input} placeholder="Ex: João da Silva" /></div>
            <div><label className={THEME.label}>Nascimento</label><input name="birthDate" type="date" required className={THEME.input} /></div>
            <div><label className={THEME.label}>Convênio / Pagador</label><select name="payerId" required className={THEME.input}><option value="">Selecione...</option>{payers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><label className={THEME.label}>Acomodação Autorizada</label><select name="entitledCategory" required className={THEME.input}>{BED_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className={THEME.label}>Patologia (CID)</label><select name="cidId" required className={THEME.input}><option value="">Selecione o CID...</option>{cids.map(c => <option key={c.id} value={c.id}>{c.code} - {c.description}</option>)}</select></div>
            <div><label className={THEME.label}>Data Admissão</label><input name="admissionDate" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className={THEME.input} /></div>
            <div><label className={THEME.label}>Médico Assistente</label><select name="doctorName" required className={THEME.input}><option value="">Selecione...</option>{doctors.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}</select></div>
            <button className="col-span-2 h-24 bg-emerald-800 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-emerald-900/20 mt-6 active:scale-[0.98] transition-all">EFETIVAR INTERNAÇÃO</button>
         </form>
      </Modal>
    </div>
  );
};

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; maxWidth?: string }> = ({ isOpen, onClose, title, children, maxWidth = "max-w-2xl" }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-emerald-950/40 backdrop-blur-md animate-in fade-in duration-300">
      <div className={`bg-white rounded-[3.5rem] w-full ${maxWidth} shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20`}>
        <div className="px-12 py-10 border-b flex justify-between items-center bg-slate-50/50">
          <h3 className="text-3xl font-black text-emerald-950 tracking-tighter">{title}</h3>
          <button onClick={onClose} className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-400 hover:text-rose-500 hover:shadow-md transition-all"><i className="fa-solid fa-times"></i></button>
        </div>
        <div className="p-12 max-h-[85vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

const KPICard: React.FC<{ title: string; value: any; sub: string; icon: string; color: string; bg: string }> = ({ title, value, sub, icon, color, bg }) => (
  <div className={`${THEME.card} p-10 group`}>
    <div className="flex items-center justify-between mb-6">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{title}</span>
      <div className={`w-12 h-12 rounded-2xl ${bg} ${color} flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-all`}><i className={`fa-solid ${icon}`}></i></div>
    </div>
    <h4 className="text-4xl font-black text-emerald-950 tracking-tighter">{value}</h4>
    <p className="text-[10px] font-bold text-slate-300 uppercase mt-2 tracking-widest">{sub}</p>
  </div>
);

const BedCard: React.FC<{ bed: Bed; onClick: () => void }> = ({ bed, onClick }) => {
  const config = STATUS_CONFIG[bed.status];
  const age = calculateAge(bed.birthDate);
  return (
    <div onClick={onClick} className={`p-8 rounded-[3rem] border-2 bg-white cursor-pointer transition-all hover:shadow-2xl ${config.border} h-[360px] flex flex-col justify-between group relative overflow-hidden`}>
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
         <div className="text-6xl">{config.icon}</div>
      </div>
      <div>
        <div className="flex justify-between items-start mb-6">
          <span className="text-4xl font-black text-emerald-950 tracking-tighter">{bed.number}</span>
          <div className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm ${config.bg} ${config.color}`}>{config.label}</div>
        </div>
        {bed.patientName ? (
          <div className="space-y-4">
            <p className="text-xl font-black text-emerald-950 line-clamp-2 uppercase leading-tight tracking-tight">{bed.patientName}</p>
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
               <div className="flex justify-between items-center mb-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase">Autorizado: {bed.entitledCategory}</p>
                  <span className="text-[10px] font-black text-emerald-700">{age} <span className="opacity-50">ANOS</span></span>
               </div>
               <p className="text-[11px] font-black text-emerald-900 truncate"><i className="fa-solid fa-user-doctor mr-2 opacity-30"></i>{bed.doctorName || 'Doutor não atribuído'}</p>
            </div>
          </div>
        ) : (
          <div className="h-40 flex flex-col items-center justify-center opacity-5 grayscale group-hover:grayscale-0 transition-all">
             <i className="fa-solid fa-bed-pulse text-7xl"></i>
             <p className="text-[10px] font-black uppercase mt-4 tracking-widest">{bed.category}</p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between pt-6 border-t border-slate-50">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.bg} ${config.color} shadow-sm group-hover:scale-110 transition-all`}>{config.icon}</div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
           <span className="text-[9px] font-black text-emerald-900 uppercase">Gerenciar</span>
           <i className="fa-solid fa-arrow-right text-slate-300 text-xs"></i>
        </div>
      </div>
    </div>
  );
};

export default App;
