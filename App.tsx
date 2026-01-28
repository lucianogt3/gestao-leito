
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

// Normalização profissional de formulário (Prepara o payload para o "backend")
const normalizeOccupyPayload = (fd: FormData) => {
  const obj = Object.fromEntries(fd.entries());
  return {
    patientName: String(obj.patientName || '').trim().toUpperCase(),
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
    } catch (error) {
      console.error("Erro ao sincronizar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = beds.length;
    const ocupados = beds.filter(b => b.status === BedStatus.OCUPADO).length;
    const occupancyRate = total > 0 ? (ocupados / total) * 100 : 0;
    
    // Turnover (Giro de Leitos): Razão entre altas e leitos disponíveis no período
    const historyWithRelease = history.filter(h => h.releaseDate);
    const turnover = total > 0 ? historyWithRelease.length / total : 0;

    // LOS (Length of Stay - Média de Permanência)
    const avgStay = historyWithRelease.length > 0 
      ? historyWithRelease.reduce((acc, curr) => {
          const start = new Date(curr.admissionDate).getTime();
          const end = new Date(curr.releaseDate!).getTime();
          const diffDays = (end - start) / (1000 * 60 * 60 * 24);
          return acc + Math.max(0.5, diffDays); // Mínimo de meio dia por internação
        }, 0) / historyWithRelease.length
      : 0;

    // Divergência: Paciente em acomodação diferente da autorizada
    const mismatchCount = beds.filter(b => b.status === BedStatus.OCUPADO && b.entitledCategory && b.entitledCategory !== b.category).length;

    return {
      total, ocupados, occupancyRate,
      bedTurnover: turnover,
      avgStay: avgStay.toFixed(1),
      mismatchCount
    };
  }, [beds, history]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const user = fd.get('user') as string;
    const newUser: User = user === 'admin' 
      ? { id: '1', username: 'NIR Central', role: 'ADMIN' }
      : { id: '2', username: 'Enfermagem Unid.', role: 'DIRETOR' };
    
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
    } catch (e) {
      alert("Erro ao processar admissão. Verifique a conexão.");
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
    } catch (e) {
      alert("Erro ao atualizar status. Transação cancelada pelo servidor.");
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) return (
    <div className="min-h-screen bg-emerald-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[50vw] h-full bg-white opacity-5 skew-x-12 translate-x-20"></div>
      <div className="bg-white rounded-[3rem] p-16 shadow-2xl w-full max-w-lg relative z-10 border border-emerald-900/10 animate-in zoom-in-95 duration-500">
        <div className="text-center mb-12">
          <div className="bg-emerald-800 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-500/20">
            <i className="fa-solid fa-hospital-user text-white text-4xl"></i>
          </div>
          <h1 className="text-4xl font-black text-emerald-950 tracking-tighter uppercase">BEM T CARE</h1>
          <p className="text-emerald-800/40 font-bold uppercase text-[10px] tracking-[0.4em] mt-3">SISTEMA DE GESTÃO DE LEITOS PRO</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-1">
            <label className={THEME.label}>Identificação</label>
            <input name="user" required className={THEME.input} placeholder="Usuário (admin ou op)" />
          </div>
          <div className="space-y-1">
            <label className={THEME.label}>Chave de Acesso</label>
            <input type="password" required className={THEME.input} placeholder="••••••••" />
          </div>
          <button className="w-full h-16 bg-emerald-800 hover:bg-emerald-900 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-900/20 active:scale-95 transition-all mt-4">ACESSAR UNIDADE</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8faf9] flex flex-col">
      <header className="bg-emerald-950 px-10 py-5 flex justify-between items-center shadow-2xl z-50 sticky top-0 backdrop-blur-md bg-emerald-950/95">
        <div className="flex items-center gap-4">
           <div className="bg-emerald-800 p-3 rounded-xl shadow-lg border border-white/5"><i className="fa-solid fa-hospital-user text-white"></i></div>
           <h1 className="text-xl font-black text-white tracking-tighter">BEM T CARE <span className="text-emerald-400">PRO</span></h1>
        </div>
        <nav className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10">
          {[
            { id: 'DASHBOARD', label: 'Mapa de Leitos', icon: 'fa-bed' },
            { id: 'KPI', label: 'Indicadores', icon: 'fa-chart-line' },
            { id: 'AUDIT', label: 'Auditoria', icon: 'fa-shield-halved' },
            { id: 'SETTINGS', label: 'Configurações', icon: 'fa-gear' }
          ].map(tab => (
            (tab.id !== 'SETTINGS' || currentUser.role === 'ADMIN') && (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white text-emerald-950 shadow-xl' : 'text-white/40 hover:text-white'}`}>
                <i className={`fa-solid ${tab.icon} opacity-60`}></i>
                {tab.label}
              </button>
            )
          ))}
        </nav>
        <div className="flex items-center gap-8">
           <div className="text-right border-r border-white/10 pr-6">
              <p className="text-[10px] font-black text-emerald-400 uppercase leading-none">{currentUser.username}</p>
              <p className="text-[9px] text-white/30 font-bold mt-1 tracking-widest">{currentUser.role === 'ADMIN' ? 'NIR MASTER' : 'UNID. OPERACIONAL'}</p>
           </div>
           <button onClick={handleLogout} className="w-10 h-10 rounded-xl bg-white/5 text-emerald-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center border border-white/10"><i className="fa-solid fa-power-off"></i></button>
        </div>
      </header>

      {loading && (
        <div className="fixed bottom-10 right-10 bg-white border-2 border-emerald-800 p-6 rounded-[2.5rem] shadow-2xl z-[500] flex items-center gap-4 animate-in slide-in-from-bottom-10 border-emerald-800/20">
          <div className="w-5 h-5 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-900">Sincronizando com Servidor...</p>
        </div>
      )}

      <main className="flex-1 p-12 max-w-[1920px] mx-auto w-full">
        {activeTab === 'DASHBOARD' && (
          <div className="space-y-10">
             <div className="flex justify-between items-end">
                <div className="space-y-2">
                  <h2 className="text-4xl font-black text-emerald-950 tracking-tighter">Quadro Operacional</h2>
                  <div className="flex items-center gap-3">
                     <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Monitoramento em Tempo Real • {beds.length} Leitos Ativos</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={loadData} className="w-14 h-14 bg-white border-2 border-slate-100 rounded-2xl text-slate-400 hover:text-emerald-600 hover:border-emerald-100 transition-all flex items-center justify-center shadow-sm"><i className="fa-solid fa-rotate"></i></button>
                  <select value={activeSectorId || ''} onChange={e => setActiveSectorId(e.target.value || null)} className="bg-white border-2 border-slate-100 rounded-2xl px-8 py-4 text-xs font-black uppercase outline-none shadow-sm focus:border-emerald-600 transition-all cursor-pointer">
                    <option value="">Todos os Setores</option>
                    {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
                {beds.filter(b => !activeSectorId || b.sectorId === activeSectorId).map(bed => (
                  <BedCard key={bed.id} bed={bed} onClick={() => { setSelectedBed(bed); setIsBedActionModalOpen(true); }} />
                ))}
             </div>
          </div>
        )}

        {activeTab === 'AUDIT' && (
          <div className="max-w-6xl mx-auto bg-white rounded-[3.5rem] p-16 shadow-xl border border-slate-100 animate-in fade-in slide-in-from-bottom-5">
             <div className="flex justify-between items-center mb-12">
                <div>
                   <h2 className="text-4xl font-black text-emerald-950 tracking-tighter">Rastro de Auditoria</h2>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Logs de segurança e transações do sistema</p>
                </div>
                <div className="flex gap-4">
                   <button className="px-6 py-3 bg-slate-50 text-[10px] font-black uppercase rounded-xl border text-slate-500 hover:bg-slate-100 transition-all"><i className="fa-solid fa-download mr-2"></i>Exportar</button>
                   <button onClick={loadData} className="px-6 py-3 bg-emerald-50 text-[10px] font-black uppercase rounded-xl border border-emerald-100 text-emerald-700 hover:bg-emerald-100 transition-all"><i className="fa-solid fa-sync mr-2"></i>Sincronizar</button>
                </div>
             </div>
             <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                {auditLogs.length === 0 ? (
                  <div className="py-20 text-center opacity-20">
                     <i className="fa-solid fa-shield-halved text-8xl mb-4"></i>
                     <p className="font-black uppercase tracking-widest">Nenhum log registrado hoje</p>
                  </div>
                ) : auditLogs.map(log => (
                  <div key={log.id} className="p-8 bg-slate-50/50 rounded-3xl border border-slate-100 flex justify-between items-center hover:bg-white hover:shadow-xl transition-all group border-l-8 border-l-emerald-600">
                     <div className="flex gap-8 items-center">
                        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all text-xl"><i className="fa-solid fa-key"></i></div>
                        <div>
                           <div className="flex items-center gap-4">
                              <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-4 py-1.5 rounded-full uppercase tracking-tighter">{log.action}</span>
                              <span className="text-lg font-bold text-slate-800 tracking-tight">{log.details}</span>
                           </div>
                           <p className="text-[10px] text-slate-400 font-bold uppercase mt-3 flex items-center gap-4">
                              <span><i className="fa-solid fa-bed mr-2"></i>LEITO {log.bedNumber}</span>
                              <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                              <span className="text-emerald-900"><i className="fa-solid fa-user-shield mr-2"></i>OPERADOR: {log.user}</span>
                           </p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-lg font-black text-emerald-950 leading-none">{new Date(log.timestamp).toLocaleTimeString()}</p>
                        <p className="text-[10px] text-slate-300 font-bold uppercase mt-2 tracking-widest">{new Date(log.timestamp).toLocaleDateString()}</p>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'KPI' && (
          <div className="space-y-12 animate-in fade-in duration-700">
             <div className="flex justify-between items-end">
                <div className="space-y-2">
                   <h2 className="text-4xl font-black text-emerald-950 tracking-tighter">Painel de Performance</h2>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Métricas consolidadas de giro e permanência</p>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex gap-4">
                   <div className="px-4 py-2 bg-emerald-50 rounded-xl text-[10px] font-black text-emerald-700 uppercase">Janeiro 2024</div>
                </div>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <KPICard title="Taxa de Ocupação" value={`${stats.occupancyRate.toFixed(1)}%`} sub="Capacidade Total" icon="fa-chart-pie" color="text-emerald-700" bg="bg-emerald-50" />
                <KPICard title="Giro de Leitos" value={stats.bedTurnover.toFixed(2)} sub="Altas / Leitos" icon="fa-rotate" color="text-blue-600" bg="bg-blue-50" />
                <KPICard title="Permanência (LOS)" value={`${stats.avgStay}d`} sub="Tempo Médio" icon="fa-hourglass-half" color="text-amber-600" bg="bg-amber-50" />
                <KPICard title="Acom. Divergente" value={stats.mismatchCount} sub="Atenção NIR" icon="fa-triangle-exclamation" color="text-rose-600" bg="bg-rose-50" />
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-xl h-[450px] flex flex-col">
                   <h3 className="text-xl font-black text-emerald-950 mb-10 tracking-tighter uppercase text-[12px] tracking-widest text-slate-400">Distribuição de Status</h3>
                   <div className="flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                            <Pie data={beds.reduce((acc: any[], b) => {
                               const found = acc.find(x => x.name === b.status);
                               if (found) found.value++;
                               else acc.push({ name: b.status, value: 1 });
                               return acc;
                            }, [])} innerRadius={80} outerRadius={120} paddingAngle={10} dataKey="value">
                               {beds.reduce((acc: any[], b) => {
                                  if (!acc.includes(b.status)) acc.push(b.status);
                                  return acc;
                               }, []).map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={STATUS_CONFIG[entry as BedStatus].color.replace('text-', '#').replace('700', '600').replace('emerald', '10b981').replace('rose', 'f43f5e').replace('amber', 'f59e0b').replace('blue', '3b82f6').replace('gray', '94a3b8')} />
                               ))}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" height={36}/>
                         </PieChart>
                      </ResponsiveContainer>
                   </div>
                </div>
                <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-xl h-[450px] flex flex-col">
                   <h3 className="text-xl font-black text-emerald-950 mb-10 tracking-tighter uppercase text-[12px] tracking-widest text-slate-400">Histórico de Movimentação</h3>
                   <div className="flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={history.reduce((acc: any[], h) => {
                            const date = h.admissionDate;
                            const found = acc.find(x => x.date === date);
                            if (found) found.count++;
                            else acc.push({ date, count: 1 });
                            return acc;
                         }, []).slice(-7)}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800}} />
                            <Tooltip />
                            <Bar dataKey="count" fill="#064e3b" radius={[10, 10, 0, 0]} />
                         </BarChart>
                      </ResponsiveContainer>
                   </div>
                </div>
             </div>
          </div>
        )}
      </main>

      {/* MODAL DE GESTÃO DO LEITO */}
      <Modal isOpen={isBedActionModalOpen && !!selectedBed} onClose={() => setIsBedActionModalOpen(false)} title={`Gestão: Leito ${selectedBed?.number}`}>
         {selectedBed && (
           <div className="space-y-10">
              <div className={`p-10 rounded-[2.5rem] ${STATUS_CONFIG[selectedBed.status].bg} ${STATUS_CONFIG[selectedBed.status].color} flex items-center gap-8 shadow-inner border-2 ${STATUS_CONFIG[selectedBed.status].border}`}>
                 <div className="text-5xl">{STATUS_CONFIG[selectedBed.status].icon}</div>
                 <div>
                    <p className="text-[10px] font-black uppercase opacity-60 tracking-[0.2em] mb-1">{selectedBed.category}</p>
                    <h4 className="text-4xl font-black tracking-tighter uppercase">{STATUS_CONFIG[selectedBed.status].label}</h4>
                 </div>
              </div>
              
              {selectedBed.status === BedStatus.LIVRE ? (
                <div className="grid grid-cols-1 gap-6">
                   <button onClick={() => { setIsOccupyModalOpen(true); setIsBedActionModalOpen(false); }} className="w-full h-28 bg-emerald-800 text-white rounded-[2rem] font-black text-2xl shadow-2xl shadow-emerald-900/20 hover:bg-emerald-900 active:scale-95 transition-all flex items-center justify-center gap-6"><i className="fa-solid fa-user-plus"></i>REALIZAR INTERNAÇÃO</button>
                   <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => handleUpdateBedStatus(selectedBed.id, BedStatus.BLOQUEADO)} className="h-20 bg-slate-100 text-slate-500 rounded-2xl font-black hover:bg-slate-200 transition-all uppercase text-[11px] tracking-widest"><i className="fa-solid fa-ban mr-2"></i>Bloquear</button>
                      <button className="h-20 bg-blue-50 text-blue-600 rounded-2xl font-black hover:bg-blue-100 transition-all uppercase text-[11px] tracking-widest"><i className="fa-solid fa-calendar-check mr-2"></i>Reservar</button>
                   </div>
                </div>
              ) : selectedBed.status === BedStatus.OCUPADO ? (
                <div className="space-y-8">
                   <div className="p-12 bg-slate-50 rounded-[3rem] border border-slate-100 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 opacity-5 text-8xl"><i className="fa-solid fa-id-card"></i></div>
                      <p className={THEME.label}>Paciente Internado</p>
                      <p className="font-black text-emerald-950 text-3xl uppercase mb-6 tracking-tight leading-none">{selectedBed.patientName}</p>
                      <div className="grid grid-cols-2 gap-6">
                         <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                            <p className="text-[9px] font-black text-slate-300 uppercase mb-1">Assistente</p>
                            <p className="text-[13px] font-black text-emerald-900 uppercase">DR. {selectedBed.doctorName}</p>
                         </div>
                         <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                            <p className="text-[9px] font-black text-slate-300 uppercase mb-1">Convênio</p>
                            <p className="text-[13px] font-black text-emerald-900 uppercase">{payers.find(p => p.id === selectedBed.payerId)?.name || 'N/A'}</p>
                         </div>
                      </div>
                      <div className="mt-6 flex items-center gap-4 px-4 py-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                         <i className="fa-solid fa-clock text-emerald-400"></i>
                         <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Admitido em: {new Date(selectedBed.admissionDate || '').toLocaleDateString()}</span>
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-6">
                      <button onClick={() => handleUpdateBedStatus(selectedBed.id, BedStatus.HIGIENIZACAO)} className="h-24 bg-amber-500 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-amber-900/10 hover:bg-amber-600 active:scale-95 transition-all flex items-center justify-center gap-4"><i className="fa-solid fa-soap"></i>ALTA / HIGIENE</button>
                      <button className="h-24 bg-indigo-600 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-indigo-900/10 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-4"><i className="fa-solid fa-right-left"></i>TRANSFERIR</button>
                   </div>
                </div>
              ) : selectedBed.status === BedStatus.HIGIENIZACAO ? (
                 <div className="space-y-8 text-center">
                    <div className="p-16 bg-amber-50/30 rounded-[3rem] border-2 border-dashed border-amber-200 flex flex-col items-center gap-6">
                       <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-amber-500 shadow-xl border border-amber-100"><i className="fa-solid fa-soap text-4xl animate-bounce"></i></div>
                       <div>
                          <p className="font-black text-amber-900 uppercase text-xl tracking-tighter">Limpeza em Andamento</p>
                          <p className="text-[10px] font-bold text-amber-600/60 uppercase tracking-widest mt-2">O leito ainda contém dados do último paciente</p>
                       </div>
                    </div>
                    <button onClick={() => handleUpdateBedStatus(selectedBed.id, BedStatus.LIVRE)} className="w-full h-24 bg-emerald-800 text-white rounded-[2rem] font-black text-xl hover:bg-emerald-900 active:scale-95 transition-all shadow-xl shadow-emerald-900/10">CONCLUIR LIMPEZA & LIBERAR</button>
                 </div>
              ) : (
                <button onClick={() => handleUpdateBedStatus(selectedBed.id, BedStatus.LIVRE)} className="w-full h-24 bg-emerald-800 text-white rounded-[2rem] font-black text-xl hover:bg-emerald-900 transition-all shadow-xl">REATIVAR LEITO</button>
              )}
           </div>
         )}
      </Modal>

      {/* MODAL DE ADMISSÃO (NIR) */}
      <Modal isOpen={isOccupyModalOpen} onClose={() => setIsOccupyModalOpen(false)} title="Admissão Hospitalar • NIR" maxWidth="max-w-5xl">
         <form onSubmit={e => { e.preventDefault(); handleOccupyBed(normalizeOccupyPayload(new FormData(e.currentTarget))); }} className="grid grid-cols-6 gap-8">
            <div className="col-span-6"><label className={THEME.label}>Paciente (Nome Completo)</label><input name="patientName" required className={THEME.input} placeholder="Ex: JOÃO DA SILVA SAURO" /></div>
            <div className="col-span-2"><label className={THEME.label}>Nascimento</label><input name="birthDate" type="date" required className={THEME.input} /></div>
            <div className="col-span-2"><label className={THEME.label}>Convênio Autorizado</label><select name="payerId" required className={THEME.input}><option value="">Selecione...</option>{payers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="col-span-2"><label className={THEME.label}>Acomodação Plano</label><select name="entitledCategory" required className={THEME.input}>{BED_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div className="col-span-3"><label className={THEME.label}>Diagnóstico Inicial (CID-10)</label><select name="cidId" required className={THEME.input}><option value="">Selecione...</option>{cids.map(c => <option key={c.id} value={c.id}>{c.code} - {c.description}</option>)}</select></div>
            <div className="col-span-3"><label className={THEME.label}>Médico Solicitante</label><select name="doctorName" required className={THEME.input}><option value="">Selecione...</option>{doctors.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}</select></div>
            <div className="col-span-3"><label className={THEME.label}>Tipo de Internação</label><select name="admissionType" required className={THEME.input}><option value="CLINICO">CLÍNICO</option><option value="CIRURGICO">CIRÚRGICO</option></select></div>
            <div className="col-span-3"><label className={THEME.label}>Data de Entrada</label><input name="admissionDate" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className={THEME.input} /></div>
            <div className="col-span-6 pt-6 border-t border-slate-100 flex gap-4">
               <button type="button" onClick={() => setIsOccupyModalOpen(false)} className="flex-1 h-20 bg-slate-50 text-slate-400 rounded-3xl font-black uppercase tracking-widest hover:bg-slate-100 transition-all">Cancelar</button>
               <button type="submit" className="flex-[2] h-20 bg-emerald-800 text-white rounded-[2rem] font-black text-2xl shadow-2xl shadow-emerald-900/20 hover:bg-emerald-900 active:scale-[0.98] transition-all">EFETIVAR INTERNAÇÃO</button>
            </div>
         </form>
      </Modal>
    </div>
  );
};

// COMPONENTES AUXILIARES REFINADOS
const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; maxWidth?: string }> = ({ isOpen, onClose, title, children, maxWidth = "max-w-3xl" }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-emerald-950/50 backdrop-blur-md animate-in fade-in duration-300">
      <div className={`bg-white rounded-[4rem] w-full ${maxWidth} shadow-[0_40px_100px_rgba(0,0,0,0.3)] overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20`}>
        <div className="px-16 py-12 border-b flex justify-between items-center bg-slate-50/30">
          <h3 className="text-4xl font-black text-emerald-950 tracking-tighter uppercase leading-none">{title}</h3>
          <button onClick={onClose} className="w-14 h-14 rounded-2xl bg-white shadow-xl flex items-center justify-center text-slate-400 hover:text-rose-500 hover:rotate-90 transition-all border border-slate-100"><i className="fa-solid fa-times text-xl"></i></button>
        </div>
        <div className="p-16 max-h-[85vh] overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>
  );
};

const KPICard: React.FC<{ title: string; value: any; sub: string; icon: string; color: string; bg: string }> = ({ title, value, sub, icon, color, bg }) => (
  <div className={`${THEME.card} p-12 group relative overflow-hidden`}>
    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-125 transition-all duration-700">
       <i className={`fa-solid ${icon} text-9xl`}></i>
    </div>
    <div className="flex items-center justify-between mb-8">
      <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">{title}</span>
      <div className={`w-14 h-14 rounded-3xl ${bg} ${color} flex items-center justify-center text-2xl shadow-inner group-hover:shadow-lg transition-all`}><i className={`fa-solid ${icon}`}></i></div>
    </div>
    <h4 className="text-5xl font-black text-emerald-950 tracking-tighter mb-2">{value}</h4>
    <p className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">{sub}</p>
  </div>
);

const BedCard: React.FC<{ bed: Bed; onClick: () => void }> = ({ bed, onClick }) => {
  const config = STATUS_CONFIG[bed.status];
  const age = calculateAge(bed.birthDate);
  return (
    <div onClick={onClick} className={`p-10 rounded-[3.5rem] border-2 bg-white cursor-pointer transition-all hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] ${config.border} h-[380px] flex flex-col justify-between group relative overflow-hidden active:scale-95`}>
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500">
         <div className="text-9xl">{config.icon}</div>
      </div>
      <div>
        <div className="flex justify-between items-start mb-8">
          <span className="text-5xl font-black text-emerald-950 tracking-tighter">{bed.number}</span>
          <div className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-inner ${config.bg} ${config.color}`}>{config.label}</div>
        </div>
        {bed.patientName ? (
          <div className="space-y-5">
            <p className="text-2xl font-black text-emerald-950 line-clamp-2 uppercase leading-[1.1] tracking-tight">{bed.patientName}</p>
            <div className="bg-slate-50/80 p-6 rounded-[2rem] border border-slate-100 shadow-sm backdrop-blur-sm">
               <div className="flex justify-between items-center mb-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">PLAN: {bed.entitledCategory}</p>
                  <span className="text-[11px] font-black text-emerald-700 bg-emerald-100 px-3 py-1 rounded-lg">{age} <span className="opacity-50">ANOS</span></span>
               </div>
               <p className="text-[12px] font-black text-emerald-900 truncate flex items-center"><i className="fa-solid fa-user-doctor mr-3 opacity-20"></i>{bed.doctorName || 'NIR AGUARDANDO'}</p>
            </div>
          </div>
        ) : (
          <div className="h-44 flex flex-col items-center justify-center opacity-5 grayscale group-hover:grayscale-0 group-hover:opacity-10 transition-all duration-700">
             <i className="fa-solid fa-bed-pulse text-8xl mb-4"></i>
             <p className="text-[12px] font-black uppercase tracking-[0.4em]">{bed.category}</p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between pt-8 border-t border-slate-50">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${config.bg} ${config.color} shadow-sm group-hover:scale-110 transition-all`}>{config.icon}</div>
        <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-6 group-hover:translate-x-0">
           <span className="text-[10px] font-black text-emerald-900 uppercase tracking-widest">Ações</span>
           <div className="w-8 h-8 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-700"><i className="fa-solid fa-chevron-right text-[10px]"></i></div>
        </div>
      </div>
    </div>
  );
};

export default App;
