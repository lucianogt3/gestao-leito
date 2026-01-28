
import React, { useState, useEffect, useMemo } from 'react';
import { Bed, Sector, BedStatus, Payer, Cid, AdmissionType, InternmentHistory, Doctor, User, Procedure } from './types';
import { DB } from './services/db';
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
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'SETTINGS' | 'KPI'>('DASHBOARD');
  const [settingsTab, setSettingsTab] = useState<'SECTORS' | 'DOCTORS' | 'PAYERS' | 'CIDS' | 'PROCEDURES'>('SECTORS');

  const [sectors, setSectors] = useState<Sector[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [payers, setPayers] = useState<Payer[]>([]);
  const [cids, setCids] = useState<Cid[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [history, setHistory] = useState<InternmentHistory[]>([]);
  
  const [activeSectorId, setActiveSectorId] = useState<string | null>(null);
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);
  const [modalAdmType, setModalAdmType] = useState<AdmissionType>('CLINICO');
  const [loading, setLoading] = useState(true);

  const [isOccupyModalOpen, setIsOccupyModalOpen] = useState(false);
  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
  const [isBedActionModalOpen, setIsBedActionModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isNewSectorModalOpen, setIsNewSectorModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, b, p, c, d, pr, h] = await Promise.all([
        DB.getSectors(), DB.getBeds(), DB.getPayers(), 
        DB.getCids(), DB.getDoctors(), DB.getProcedures(), DB.getHistory()
      ]);
      setSectors(s); setBeds(b); setPayers(p); setCids(c); 
      setDoctors(d); setProcedures(pr); setHistory(h);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = beds.length;
    const ocupados = beds.filter(b => b.status === BedStatus.OCUPADO).length;
    const livres = beds.filter(b => b.status === BedStatus.LIVRE).length;
    const reservado = beds.filter(b => b.status === BedStatus.RESERVADO).length;
    
    const clinicoCount = beds.filter(b => b.status === BedStatus.OCUPADO && b.admissionType === 'CLINICO').length;
    const cirurgicoCount = beds.filter(b => b.status === BedStatus.OCUPADO && b.admissionType === 'CIRURGICO').length;
    const mismatchCount = beds.filter(b => b.status === BedStatus.OCUPADO && b.entitledCategory && b.entitledCategory !== b.category).length;

    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthHist = history.filter(h => h.admissionDate.startsWith(thisMonth));
    const bedTurnover = total > 0 ? monthHist.length / total : 0;

    return {
      total, ocupados, livres, reservado,
      clinicoCount, cirurgicoCount, mismatchCount,
      occupancyRate: total > 0 ? (ocupados / total) * 100 : 0,
      bedTurnover,
      chartData: [
        { name: 'Livre', value: livres, color: '#10b981' },
        { name: 'Ocupado', value: ocupados, color: '#f43f5e' },
        { name: 'Reserva', value: reservado, color: '#3b82f6' },
        { name: 'Higienização', value: beds.filter(b => b.status === BedStatus.HIGIENIZACAO).length, color: '#f59e0b' }
      ]
    };
  }, [beds, history]);

  const isAdmin = currentUser?.role === 'ADMIN';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const user = fd.get('user') as string;
    const pass = fd.get('pass') as string;
    if (user === 'admin' && pass === 'admin') setCurrentUser({ id: '1', username: 'Administrador', role: 'ADMIN' });
    else if (user === 'diretor' && pass === 'diretor') setCurrentUser({ id: '2', username: 'Diretoria', role: 'DIRETOR' });
    else alert('Credenciais inválidas. Tente admin/admin ou diretor/diretor');
  };

  const syncBeds = async (updated: Bed[]) => { setBeds(updated); await DB.saveBeds(updated); };
  const syncSectors = async (updated: Sector[]) => { setSectors(updated); await DB.saveSectors(updated); };
  const syncDoctors = async (updated: Doctor[]) => { setDoctors(updated); await DB.saveDoctors(updated); };
  const syncPayers = async (updated: Payer[]) => { setPayers(updated); await DB.savePayers(updated); };
  const syncCids = async (updated: Cid[]) => { setCids(updated); await DB.saveCids(updated); };
  const syncProcedures = async (updated: Procedure[]) => { setProcedures(updated); await DB.saveProcedures(updated); };

  const handleOccupyBed = async (formData: any) => {
    if (!selectedBed) return;
    const nextStatus = formData.status || BedStatus.OCUPADO;
    
    if (formData.entitledCategory && formData.entitledCategory !== selectedBed.category) {
      const confirmMsg = `Divergência de Acomodação!\n\nO paciente tem direito a: ${formData.entitledCategory}\nO leito atual é: ${selectedBed.category}\n\nDeseja continuar mesmo assim?`;
      if (!confirm(confirmMsg)) return;
    }

    const updatedBeds = beds.map(b => {
      if (b.id === selectedBed.id) {
        return {
          ...b,
          status: nextStatus,
          patientName: formData.patientName,
          birthDate: formData.birthDate,
          doctorName: formData.doctorName,
          payerId: formData.payerId,
          cidId: formData.cidId,
          admissionType: formData.admissionType as AdmissionType,
          procedureId: formData.admissionType === 'CIRURGICO' ? formData.procedureId : undefined,
          admissionDate: formData.admissionDate,
          admissionTime: formData.admissionTime,
          occupiedAt: nextStatus === BedStatus.OCUPADO ? new Date().toISOString() : b.occupiedAt,
          entitledCategory: formData.entitledCategory
        };
      }
      return b;
    });

    if (nextStatus === BedStatus.OCUPADO) {
      const newHistory: InternmentHistory = {
        id: Math.random().toString(36).substr(2, 9),
        bedId: selectedBed.id,
        sectorId: selectedBed.sectorId,
        patientName: formData.patientName,
        doctorName: formData.doctorName || 'Não informado',
        admissionType: (formData.admissionType as AdmissionType) || 'CLINICO',
        admissionDate: formData.admissionDate || new Date().toISOString().split('T')[0],
        payerId: formData.payerId,
        cidId: formData.cidId,
        entitledCategory: formData.entitledCategory
      };
      const newHistoryList = [...history, newHistory];
      setHistory(newHistoryList);
      await DB.saveHistory(newHistoryList);
    }

    await syncBeds(updatedBeds);
    setIsOccupyModalOpen(false);
    setIsReserveModalOpen(false);
    setSelectedBed(null);
  };

  const handleUpdateBedStatus = async (bedId: string, nextStatus: BedStatus) => {
    const updatedBeds = beds.map(b => {
      if (b.id === bedId) {
        const isClearing = nextStatus === BedStatus.LIVRE || nextStatus === BedStatus.HIGIENIZACAO || nextStatus === BedStatus.BLOQUEADO;
        return { 
          ...b, 
          status: nextStatus, 
          patientName: isClearing ? undefined : b.patientName, 
          birthDate: isClearing ? undefined : b.birthDate,
          doctorName: isClearing ? undefined : b.doctorName,
          payerId: isClearing ? undefined : b.payerId,
          cidId: isClearing ? undefined : b.cidId,
          procedureId: isClearing ? undefined : b.procedureId,
          admissionType: isClearing ? undefined : b.admissionType,
          admissionDate: isClearing ? undefined : b.admissionDate,
          admissionTime: isClearing ? undefined : b.admissionTime,
          occupiedAt: isClearing ? undefined : b.occupiedAt,
          entitledCategory: isClearing ? undefined : b.entitledCategory
        };
      }
      return b;
    });
    await syncBeds(updatedBeds);
    setIsBedActionModalOpen(false);
    setSelectedBed(null);
  };

  const handleTransferOrSwap = async (formData: any) => {
    const targetBedId = formData.targetBedId;
    if (!selectedBed || !targetBedId) return;

    const targetBed = beds.find(b => b.id === targetBedId);
    if (!targetBed) return;

    const sourceData = { ...selectedBed };
    const targetData = { ...targetBed };

    const updatedBeds = beds.map(b => {
      if (b.id === sourceData.id) {
        if (targetData.status === BedStatus.LIVRE) {
          return {
            id: b.id,
            number: b.number,
            category: b.category,
            sectorId: b.sectorId,
            status: BedStatus.HIGIENIZACAO
          } as Bed;
        }
        return {
          ...b,
          status: targetData.status,
          patientName: targetData.patientName,
          birthDate: targetData.birthDate,
          medicalRecord: targetData.medicalRecord,
          notes: targetData.notes,
          payerId: targetData.payerId,
          cidId: targetData.cidId,
          procedureId: targetData.procedureId,
          doctorName: targetData.doctorName,
          admissionType: targetData.admissionType,
          admissionDate: targetData.admissionDate,
          admissionTime: targetData.admissionTime,
          occupiedAt: targetData.occupiedAt,
          entitledCategory: targetData.entitledCategory,
          reservedUntil: targetData.reservedUntil,
          reservationTime: targetData.reservationTime,
          diagnosis: targetData.diagnosis
        };
      }
      if (b.id === targetData.id) {
        return {
          ...b,
          status: sourceData.status,
          patientName: sourceData.patientName,
          birthDate: sourceData.birthDate,
          medicalRecord: sourceData.medicalRecord,
          notes: sourceData.notes,
          payerId: sourceData.payerId,
          cidId: sourceData.cidId,
          procedureId: sourceData.procedureId,
          doctorName: sourceData.doctorName,
          admissionType: sourceData.admissionType,
          admissionDate: sourceData.admissionDate,
          admissionTime: sourceData.admissionTime,
          occupiedAt: sourceData.occupiedAt,
          entitledCategory: sourceData.entitledCategory,
          reservedUntil: sourceData.reservedUntil,
          reservationTime: sourceData.reservationTime,
          diagnosis: sourceData.diagnosis
        };
      }
      return b;
    });

    await syncBeds(updatedBeds);
    setIsTransferModalOpen(false);
    setSelectedBed(null);
  };

  const handleAddBed = async (sectorId: string, number: string, category: string) => {
    if (!number) return;
    const newBed: Bed = { id: Math.random().toString(36).substr(2, 9), number, category, status: BedStatus.LIVRE, sectorId };
    await syncBeds([...beds, newBed]);
  };

  const handlePrintReport = () => {
    window.print();
  };

  if (!currentUser) return (
    <div className="min-h-screen bg-emerald-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[50vw] h-full bg-white opacity-5 skew-x-12 translate-x-20"></div>
      <div className="bg-white rounded-[3rem] p-16 shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-500 relative z-10 border border-emerald-900/10">
        <div className="text-center mb-12">
          <div className="bg-emerald-800 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-500/20">
            <i className="fa-solid fa-hospital-user text-white text-4xl"></i>
          </div>
          <h1 className="text-3xl font-black text-emerald-950 tracking-tighter">BEM T CARE</h1>
          <p className="text-emerald-800/40 font-bold uppercase text-[10px] tracking-[0.4em] mt-3">Hospital Boutique & Gestão</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-1">
            <label className={THEME.label}>Acesso ao Sistema</label>
            <input name="user" required className={THEME.input} placeholder="Usuário (admin ou diretor)" />
          </div>
          <input name="pass" type="password" required className={THEME.input} placeholder="Senha" />
          <button className="w-full h-16 bg-emerald-800 hover:bg-emerald-900 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-900/10 active:scale-95 transition-all">Entrar</button>
        </form>
        <div className="mt-12 pt-8 border-t border-slate-50 text-center">
          <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Tecnologia em Saúde e Conforto</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8faf9] flex flex-col print:bg-white">
      <header className="bg-emerald-950 border-b border-white/5 sticky top-0 z-50 px-10 py-5 flex justify-between items-center shadow-xl print:hidden">
        <div className="flex items-center gap-6">
          <div className="bg-emerald-800 p-3 rounded-2xl shadow-lg shadow-emerald-900/40"><i className="fa-solid fa-hospital-user text-white text-xl"></i></div>
          <h1 className="text-xl font-black text-white tracking-tighter">HOSPITAL <span className="text-emerald-400">BEM T CARE</span></h1>
        </div>
        <nav className="flex bg-white/5 p-1 rounded-2xl backdrop-blur-md">
          <button onClick={() => setActiveTab('DASHBOARD')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'DASHBOARD' ? 'bg-white text-emerald-950 shadow-lg' : 'text-white/40 hover:text-white'}`}>Mapa de Leitos</button>
          <button onClick={() => setActiveTab('KPI')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'KPI' ? 'bg-white text-emerald-950 shadow-lg' : 'text-white/40 hover:text-white'}`}>Painel Estratégico</button>
          {isAdmin && <button onClick={() => setActiveTab('SETTINGS')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'SETTINGS' ? 'bg-white text-emerald-950 shadow-lg' : 'text-white/40 hover:text-white'}`}>Configuração</button>}
        </nav>
        <div className="flex items-center gap-6">
          <div className="text-right border-r border-white/10 pr-6"><p className="text-[10px] font-black text-emerald-400 uppercase leading-none">{currentUser.username}</p><p className="text-[9px] text-white/30 font-bold mt-1 tracking-widest">{currentUser.role}</p></div>
          <button onClick={() => setCurrentUser(null)} className="w-10 h-10 rounded-xl bg-white/5 text-emerald-400 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"><i className="fa-solid fa-power-off"></i></button>
        </div>
      </header>

      {loading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[200] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-emerald-800 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Sincronizando Dados...</p>
          </div>
        </div>
      )}

      <main className="flex-1 p-12 print:p-0">
        {activeTab === 'KPI' ? (
          <div className="max-w-7xl mx-auto space-y-12">
            <div className="flex justify-between items-center">
               <h2 className="text-4xl font-black text-emerald-950 tracking-tighter">Indicadores Gerais</h2>
               <button onClick={handlePrintReport} className="bg-white border border-slate-200 px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-sm hover:shadow-md transition-all flex items-center gap-2">
                 <i className="fa-solid fa-file-pdf text-rose-500"></i> Exportar Mapa Ocupação
               </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <KPICard title="Taxa Ocupação" value={`${stats.occupancyRate.toFixed(1)}%`} sub="Capacidade Total" icon="fa-chart-line" color="text-emerald-700" bg="bg-emerald-50" />
              <KPICard title="Giro de Leitos" value={stats.bedTurnover.toFixed(2)} sub="Fluxo Mensal" icon="fa-rotate" color="text-indigo-600" bg="bg-indigo-50" />
              <KPICard title="Perfil Clínico" value={stats.clinicoCount} sub="Pacientes" icon="fa-notes-medical" color="text-blue-600" bg="bg-blue-50" />
              <KPICard title="Perfil Cirúrgico" value={stats.cirurgicoCount} sub="Pacientes" icon="fa-scalpel" color="text-rose-600" bg="bg-rose-50" />
              <KPICard title="Acom. Divergente" value={stats.mismatchCount} sub="Atenção" icon="fa-triangle-exclamation" color="text-amber-600" bg="bg-amber-50" />
            </div>
          </div>
        ) : activeTab === 'DASHBOARD' ? (
          <div className="space-y-10">
             <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black text-emerald-950 tracking-tighter">Gestão Operacional</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Monitoramento em Tempo Real</p>
                </div>
                <div className="flex gap-4">
                  <select value={activeSectorId || ''} onChange={e => setActiveSectorId(e.target.value || null)} className="bg-white border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-black uppercase outline-none shadow-sm focus:border-emerald-600">
                    <option value="">Todos os Setores</option>
                    {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
                {beds.filter(b => !activeSectorId || b.sectorId === activeSectorId).map(bed => (
                  <BedCard key={bed.id} bed={bed} payers={payers} onClick={() => { setSelectedBed(bed); setIsBedActionModalOpen(true); }} />
                ))}
             </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto bg-white p-12 rounded-[3rem] shadow-xl">
             <h2 className="text-3xl font-black mb-10 text-emerald-950">Configurações Bem T Care</h2>
             <div className="flex gap-4 mb-10 border-b pb-4 overflow-x-auto">
               {[
                 { id: 'SECTORS', label: 'Setores & Leitos' },
                 { id: 'DOCTORS', label: 'Médicos' },
                 { id: 'PAYERS', label: 'Convênios' },
                 { id: 'CIDS', label: 'CIDs' },
                 { id: 'PROCEDURES', label: 'Procedimentos' }
               ].map(t => (
                 <button key={t.id} onClick={() => setSettingsTab(t.id as any)} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all ${settingsTab === t.id ? 'bg-emerald-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>{t.label}</button>
               ))}
             </div>

             {settingsTab === 'SECTORS' && (
               <div className="space-y-10">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-black">Infraestrutura</h3>
                    <button onClick={() => setIsNewSectorModalOpen(true)} className={THEME.btnPrimary}>Novo Setor</button>
                  </div>
                  <div className="grid grid-cols-1 gap-8">
                    {sectors.map(s => (
                      <div key={s.id} className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                        <div className="flex justify-between items-center mb-6">
                           <div>
                             <span className="bg-emerald-800 text-white text-[9px] px-2 py-1 rounded-md font-black mr-3 uppercase">{s.code}</span>
                             <span className="text-xl font-black text-emerald-950">{s.name}</span>
                           </div>
                           <button onClick={async () => { if(confirm('Excluir setor?')) await syncSectors(sectors.filter(x => x.id !== s.id)); }} className="text-rose-500 hover:scale-110 transition-transform"><i className="fa-solid fa-trash"></i></button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                           <div className="flex gap-3 bg-white p-3 rounded-2xl shadow-sm">
                              <input id={`bed-num-${s.id}`} className="bg-slate-50 border-none rounded-xl px-4 py-2 text-sm flex-1 font-bold" placeholder="Nº Leito" />
                              <select id={`bed-cat-${s.id}`} className="bg-slate-50 border-none rounded-xl px-4 py-2 text-sm font-bold">
                                {BED_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <button onClick={() => {
                                const num = (document.getElementById(`bed-num-${s.id}`) as HTMLInputElement).value;
                                const cat = (document.getElementById(`bed-cat-${s.id}`) as HTMLSelectElement).value;
                                handleAddBed(s.id, num, cat);
                                (document.getElementById(`bed-num-${s.id}`) as HTMLInputElement).value = '';
                              }} className="bg-emerald-800 text-white px-6 rounded-xl text-[10px] font-black uppercase">Adicionar</button>
                           </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                           {beds.filter(b => b.sectorId === s.id).map(b => (
                             <div key={b.id} className={`px-4 py-3 rounded-xl border text-[10px] font-black flex items-center gap-4 shadow-sm transition-all ${b.status === BedStatus.BLOQUEADO ? 'bg-slate-100 border-slate-300 text-slate-400' : 'bg-white border-slate-100 text-slate-800'}`}>
                               <span className="text-emerald-900">{b.number}</span>
                               <span className="opacity-50 font-bold">{b.category}</span>
                               <div className="flex items-center gap-2 border-l pl-3 ml-1">
                                  <button onClick={() => handleUpdateBedStatus(b.id, b.status === BedStatus.BLOQUEADO ? BedStatus.LIVRE : BedStatus.BLOQUEADO)} title={b.status === BedStatus.BLOQUEADO ? "Desbloquear Leito" : "Bloquear Leito"} className={`hover:scale-110 transition-transform ${b.status === BedStatus.BLOQUEADO ? 'text-blue-500' : 'text-slate-300 hover:text-slate-600'}`}>
                                    <i className={`fa-solid ${b.status === BedStatus.BLOQUEADO ? 'fa-lock-open' : 'fa-lock'}`}></i>
                                  </button>
                                  <button onClick={async () => { if(confirm('Remover leito?')) await syncBeds(beds.filter(x => x.id !== b.id)); }} className="text-rose-300 hover:text-rose-500"><i className="fa-solid fa-xmark"></i></button>
                               </div>
                             </div>
                           ))}
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
             )}

             {settingsTab === 'DOCTORS' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <form onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const name = fd.get('name') as string; const spec = fd.get('spec') as string; if(!name) return; await syncDoctors([...doctors, { id: Math.random().toString(36).substr(2, 9), name, specialty: spec }]); e.currentTarget.reset(); }} className="flex flex-col md:flex-row gap-4">
                     <input name="name" required className={THEME.input} placeholder="Nome do Médico" />
                     <input name="spec" className={THEME.input} placeholder="Especialidade" />
                     <button type="submit" className={THEME.btnPrimary}>CADASTRAR</button>
                   </form>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     {doctors.map(d => <div key={d.id} className="p-6 bg-slate-50 rounded-2xl flex justify-between items-center shadow-sm border border-slate-100">
                       <div><p className="font-black text-slate-800">{d.name}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{d.specialty || 'Clínico'}</p></div>
                       <button onClick={async () => await syncDoctors(doctors.filter(x => x.id !== d.id))} className="text-rose-500 hover:scale-110 transition-transform"><i className="fa-solid fa-trash"></i></button>
                     </div>)}
                   </div>
                </div>
             )}

             {settingsTab === 'PAYERS' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                   <form onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const name = fd.get('name') as string; if(!name) return; await syncPayers([...payers, { id: Math.random().toString(36).substr(2, 9), name }]); e.currentTarget.reset(); }} className="flex gap-4">
                     <input name="name" required className={THEME.input} placeholder="Nome do Convênio" />
                     <button type="submit" className={THEME.btnPrimary}>CADASTRAR</button>
                   </form>
                   <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                     {payers.map(p => <div key={p.id} className="p-6 bg-slate-50 rounded-2xl flex justify-between items-center font-black text-slate-800 shadow-sm border border-slate-100">
                       {p.name}
                       <button onClick={async () => await syncPayers(payers.filter(x => x.id !== p.id))} className="text-rose-500"><i className="fa-solid fa-trash"></i></button>
                     </div>)}
                   </div>
                </div>
             )}

             {settingsTab === 'CIDS' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                   <form onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const code = fd.get('code') as string; const desc = fd.get('description') as string; if(!code || !desc) return; await syncCids([...cids, { id: Math.random().toString(36).substr(2, 9), code, description: desc }]); e.currentTarget.reset(); }} className="flex flex-col md:flex-row gap-4">
                     <input name="code" required className={THEME.input} placeholder="Código CID (Ex: A00)" />
                     <input name="description" required className={THEME.input} placeholder="Descrição da Patologia" />
                     <button type="submit" className={THEME.btnPrimary}>CADASTRAR</button>
                   </form>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {cids.map(c => <div key={c.id} className="p-6 bg-slate-50 rounded-2xl flex justify-between items-center shadow-sm border border-slate-100">
                       <div><span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded-md font-black mr-3 uppercase text-[10px]">{c.code}</span><span className="font-bold text-slate-700">{c.description}</span></div>
                       <button onClick={async () => await syncCids(cids.filter(x => x.id !== c.id))} className="text-rose-500"><i className="fa-solid fa-trash"></i></button>
                     </div>)}
                   </div>
                </div>
             )}

             {settingsTab === 'PROCEDURES' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                   <form onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const name = fd.get('name') as string; if(!name) return; await syncProcedures([...procedures, { id: Math.random().toString(36).substr(2, 9), name }]); e.currentTarget.reset(); }} className="flex gap-4">
                     <input name="name" required className={THEME.input} placeholder="Nome do Procedimento" />
                     <button type="submit" className={THEME.btnPrimary}>CADASTRAR</button>
                   </form>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     {procedures.map(p => <div key={p.id} className="p-6 bg-slate-50 rounded-2xl font-bold text-slate-700 flex justify-between items-center shadow-sm border border-slate-100">
                       {p.name}
                       <button onClick={async () => await syncProcedures(procedures.filter(x => x.id !== p.id))} className="text-rose-500"><i className="fa-solid fa-trash"></i></button>
                     </div>)}
                   </div>
                </div>
             )}
          </div>
        )}
      </main>

      {/* VIEW IMPRESSÃO */}
      <div className="hidden print:block p-10">
         <div className="flex justify-between items-end mb-10 border-b-4 border-emerald-950 pb-6">
            <div>
              <h1 className="text-3xl font-black text-emerald-950">MAPA DE OCUPAÇÃO BEM T CARE</h1>
              <p className="text-sm font-bold text-slate-500">Relatório Operacional: {new Date().toLocaleString('pt-BR')}</p>
            </div>
         </div>
         <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="border p-3 text-left text-[10px] uppercase font-black">Setor</th>
                <th className="border p-3 text-left text-[10px] uppercase font-black">Leito</th>
                <th className="border p-3 text-left text-[10px] uppercase font-black">Paciente</th>
                <th className="border p-3 text-left text-[10px] uppercase font-black">Idade</th>
                <th className="border p-3 text-left text-[10px] uppercase font-black">Autorizado</th>
                <th className="border p-3 text-left text-[10px] uppercase font-black">Status</th>
              </tr>
            </thead>
            <tbody>
              {beds.map(b => (
                <tr key={b.id}>
                  <td className="border p-3 text-[10px]">{sectors.find(s => s.id === b.sectorId)?.name}</td>
                  <td className="border p-3 text-[10px] font-black">{b.number}</td>
                  <td className="border p-3 text-[10px] font-bold">{b.patientName || '--'}</td>
                  <td className="border p-3 text-[10px]">{calculateAge(b.birthDate) || '--'}</td>
                  <td className="border p-3 text-[10px]">{b.entitledCategory || '--'}</td>
                  <td className="border p-3 text-[10px] font-black">{b.status}</td>
                </tr>
              ))}
            </tbody>
         </table>
      </div>

      {/* MODALS */}
      <Modal isOpen={isBedActionModalOpen && !!selectedBed} onClose={() => setIsBedActionModalOpen(false)} title={`Gestão do Leito: ${selectedBed?.number}`}>
        <div className="space-y-8">
           <div className={`p-8 rounded-[2rem] flex items-center gap-6 ${selectedBed ? STATUS_CONFIG[selectedBed.status].bg + ' ' + STATUS_CONFIG[selectedBed.status].color : ''}`}>
             <div className="text-4xl">{selectedBed && STATUS_CONFIG[selectedBed.status].icon}</div>
             <div><p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Leito {selectedBed?.category}</p><h4 className="text-2xl font-black">{selectedBed && STATUS_CONFIG[selectedBed.status].label}</h4></div>
           </div>

           {(selectedBed?.status === BedStatus.OCUPADO || selectedBed?.status === BedStatus.RESERVADO) ? (
             <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6 p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <DetailBox label="Paciente" value={selectedBed.patientName} bold full />
                  <DetailBox label="Nascimento" value={selectedBed.birthDate ? new Date(selectedBed.birthDate).toLocaleDateString('pt-BR') : '--'} />
                  <DetailBox label="Idade" value={calculateAge(selectedBed.birthDate)?.toString() + ' anos'} bold color="text-emerald-800" />
                  <DetailBox label="Acomodação Autorizada" value={selectedBed.entitledCategory} bold color={selectedBed.entitledCategory !== selectedBed.category ? "text-amber-600" : "text-emerald-800"} />
                  <DetailBox label="Convênio" value={payers.find(p => p.id === selectedBed.payerId)?.name} color="text-indigo-600" bold />
                  <DetailBox label="Médico" value={selectedBed.doctorName} />
                  <DetailBox label="Admissão" value={selectedBed.admissionDate} />
                  <DetailBox label="Patologia (CID)" value={cids.find(c => c.id === selectedBed.cidId)?.code + ' - ' + cids.find(c => c.id === selectedBed.cidId)?.description} full />
                </div>
                {isAdmin && (
                <div className="flex flex-col gap-3">
                   {selectedBed.status === BedStatus.RESERVADO && (
                     <button onClick={() => { setIsOccupyModalOpen(true); setIsBedActionModalOpen(false); }} className="w-full bg-emerald-600 text-white py-5 rounded-3xl font-black shadow-xl"><i className="fa-solid fa-hospital-user mr-2"></i> Efetivar Internação</button>
                   )}
                   <button onClick={() => { setIsTransferModalOpen(true); setIsBedActionModalOpen(false); }} className="w-full bg-emerald-900 text-white py-5 rounded-3xl font-black"><i className="fa-solid fa-shuffle mr-2"></i> Trocar de Leito</button>
                   <div className="grid grid-cols-2 gap-3">
                     <button onClick={() => handleUpdateBedStatus(selectedBed!.id, BedStatus.HIGIENIZACAO)} className="bg-amber-500 text-white py-5 rounded-3xl font-black">Alta / Higienização</button>
                     <button onClick={() => handleUpdateBedStatus(selectedBed!.id, BedStatus.LIVRE)} className="bg-rose-600 text-white py-5 rounded-3xl font-black">Cancelar</button>
                   </div>
                </div>
                )}
             </div>
           ) : selectedBed?.status === BedStatus.BLOQUEADO ? (
              <div className="space-y-6">
                <div className="p-10 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col items-center gap-4">
                  <i className="fa-solid fa-ban text-4xl text-slate-300"></i>
                  <p className="font-bold text-slate-600 text-center uppercase text-[10px] tracking-widest">Este leito está bloqueado para uso operacional.</p>
                </div>
                {isAdmin && (
                  <button onClick={() => handleUpdateBedStatus(selectedBed!.id, BedStatus.LIVRE)} className="w-full bg-emerald-800 text-white py-6 rounded-3xl font-black text-lg shadow-xl"><i className="fa-solid fa-unlock mr-2"></i> Desbloquear Leito</button>
                )}
              </div>
           ) : selectedBed?.status === BedStatus.HIGIENIZACAO ? (
              <div className="space-y-6">
                <div className="p-10 bg-amber-50 rounded-[2rem] border border-amber-100 flex flex-col items-center gap-4">
                  <i className="fa-solid fa-soap text-4xl text-amber-300"></i>
                  <p className="font-bold text-amber-600 text-center uppercase text-[10px] tracking-widest">Leito em processo de higienização.</p>
                </div>
                {isAdmin && (
                  <div className="flex flex-col gap-3">
                    <button onClick={() => handleUpdateBedStatus(selectedBed!.id, BedStatus.LIVRE)} className="w-full bg-emerald-800 text-white py-6 rounded-3xl font-black text-lg shadow-xl"><i className="fa-solid fa-check mr-2"></i> Finalizar Higienização</button>
                    <button onClick={() => handleUpdateBedStatus(selectedBed!.id, BedStatus.BLOQUEADO)} className="w-full bg-slate-200 text-slate-600 py-4 rounded-2xl font-black"><i className="fa-solid fa-ban mr-2"></i> Bloquear Leito</button>
                  </div>
                )}
              </div>
           ) : (
             <div className="flex flex-col gap-4">
               {isAdmin && (
                 <>
                   <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => { setIsOccupyModalOpen(true); setIsBedActionModalOpen(false); }} className="bg-emerald-800 text-white p-10 rounded-[2rem] font-black flex flex-col items-center gap-3 shadow-xl hover:bg-emerald-900 transition-all">
                      <i className="fa-solid fa-user-plus text-2xl"></i>Internar
                    </button>
                    <button onClick={() => { setIsReserveModalOpen(true); setIsBedActionModalOpen(false); }} className="bg-blue-600 text-white p-10 rounded-[2rem] font-black flex flex-col items-center gap-3 shadow-xl hover:bg-blue-700 transition-all">
                      <i className="fa-solid fa-calendar-check text-2xl"></i>Reservar
                    </button>
                   </div>
                   <button onClick={() => handleUpdateBedStatus(selectedBed!.id, BedStatus.BLOQUEADO)} className="bg-slate-100 text-slate-500 p-6 rounded-[1.5rem] font-black flex items-center justify-center gap-3 hover:bg-slate-200 transition-all border border-slate-200">
                     <i className="fa-solid fa-ban text-xl"></i>Bloquear Leito
                   </button>
                 </>
               )}
             </div>
           )}
        </div>
      </Modal>

      <Modal isOpen={isOccupyModalOpen} onClose={() => setIsOccupyModalOpen(false)} title="Admissão Hospitalar" maxWidth="max-w-4xl">
         <form onSubmit={e => { e.preventDefault(); handleOccupyBed(Object.fromEntries(new FormData(e.currentTarget))); }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2"><label className={THEME.label}>Nome Completo do Paciente</label><input name="patientName" required defaultValue={selectedBed?.patientName} className={THEME.input} /></div>
            <div><label className={THEME.label}>Data de Nascimento</label><input name="birthDate" type="date" required defaultValue={selectedBed?.birthDate} className={THEME.input} /></div>
            <div><label className={THEME.label}>Convênio / Pagador</label><select name="payerId" required defaultValue={selectedBed?.payerId} className={THEME.input}><option value="">Selecione...</option>{payers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            
            <div>
              <label className={THEME.label}>Acomodação Autorizada</label>
              <select name="entitledCategory" required defaultValue={selectedBed?.category || "Enfermaria"} className={THEME.input}>
                {BED_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <p className="text-[8px] text-emerald-800 mt-1 font-bold">Categoria deste leito: <span className="underline">{selectedBed?.category}</span></p>
            </div>

            <div><label className={THEME.label}>Patologia (CID)</label><select name="cidId" required defaultValue={selectedBed?.cidId} className={THEME.input}><option value="">Selecione o CID...</option>{cids.map(c => <option key={c.id} value={c.id}>{c.code} - {c.description}</option>)}</select></div>
            <div><label className={THEME.label}>Tipo de Internação</label><select name="admissionType" onChange={(e) => setModalAdmType(e.target.value as AdmissionType)} defaultValue={selectedBed?.admissionType || "CLINICO"} className={THEME.input}><option value="CLINICO">Clínico</option><option value="CIRURGICO">Cirúrgico</option></select></div>
            
            {modalAdmType === 'CIRURGICO' && (
              <div className="animate-in slide-in-from-left-4 duration-300">
                <label className={THEME.label}>Procedimento Cirúrgico</label>
                <select name="procedureId" required className={THEME.input} defaultValue={selectedBed?.procedureId}>
                  <option value="">Selecione...</option>
                  {procedures.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            
            <div><label className={THEME.label}>Data Entrada</label><input name="admissionDate" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className={THEME.input} /></div>
            <div><label className={THEME.label}>Médico Assistente</label><select name="doctorName" required defaultValue={selectedBed?.doctorName} className={THEME.input}><option value="">Selecione...</option>{doctors.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}</select></div>
            <button className="md:col-span-2 h-20 bg-emerald-800 text-white rounded-3xl font-black text-xl mt-4 shadow-xl shadow-emerald-900/10">Confirmar Admissão</button>
         </form>
      </Modal>

      <Modal isOpen={isReserveModalOpen} onClose={() => setIsReserveModalOpen(false)} title="Agendar Reserva">
         <form onSubmit={e => { e.preventDefault(); handleOccupyBed({ ...Object.fromEntries(new FormData(e.currentTarget)), status: BedStatus.RESERVADO }); }} className="space-y-6">
            <div><label className={THEME.label}>Paciente Previsto</label><input name="patientName" required className={THEME.input} /></div>
            <div><label className={THEME.label}>Data Nascimento</label><input name="birthDate" type="date" className={THEME.input} /></div>
            <div><label className={THEME.label}>Data Estimada</label><input name="admissionDate" type="date" className={THEME.input} /></div>
            <button className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black shadow-lg">Confirmar Reserva</button>
         </form>
      </Modal>

      <Modal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} title="Mudança de Leito">
         <form onSubmit={e => { e.preventDefault(); handleTransferOrSwap(Object.fromEntries(new FormData(e.currentTarget))); }} className="space-y-8">
            <div className="p-8 bg-emerald-50 rounded-[2.5rem] border border-emerald-100"><p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1">Origem</p><p className="text-2xl font-black text-emerald-950">{selectedBed?.number} — {selectedBed?.patientName}</p></div>
            <div>
              <label className={THEME.label}>Leito de Destino / Permuta</label>
              <select name="targetBedId" required className={THEME.input}>
                <option value="">Selecione o Leito...</option>
                {beds.filter(b => b.id !== selectedBed?.id).map(b => (
                  <option key={b.id} value={b.id}>{b.number} ({b.status === BedStatus.LIVRE ? 'LIVRE' : `OCUPADO POR: ${b.patientName}`})</option>
                ))}
              </select>
            </div>
            <button className={THEME.btnPrimary + " w-full h-16"}>Confirmar Mudança</button>
         </form>
      </Modal>

      <Modal isOpen={isNewSectorModalOpen} onClose={() => setIsNewSectorModalOpen(false)} title="Novo Setor">
         <form onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const name = fd.get('name') as string; const code = fd.get('code') as string; if(!name || !code) return; await syncSectors([...sectors, { id: Math.random().toString(36).substr(2, 9), name, code, order: sectors.length + 1 }]); setIsNewSectorModalOpen(false); }} className="space-y-6">
            <input name="name" required className={THEME.input} placeholder="Ex: UTI Adulto" />
            <input name="code" required className={THEME.input} placeholder="Ex: UTIA" />
            <button className={THEME.btnPrimary + " w-full"}>Criar</button>
         </form>
      </Modal>
    </div>
  );
};

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; maxWidth?: string }> = ({ isOpen, onClose, title, children, maxWidth = "max-w-2xl" }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-emerald-950/40 backdrop-blur-sm animate-in fade-in duration-300 print:hidden">
      <div className={`bg-white rounded-[3rem] w-full ${maxWidth} shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-emerald-900/10`}>
        <div className="px-12 py-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-2xl font-black text-emerald-950 tracking-tighter">{title}</h3>
          <button onClick={onClose} className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-400 hover:text-rose-500 hover:shadow-md transition-all">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>
        <div className="p-12 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

const KPICard: React.FC<{ title: string; value: any; sub: string; icon: string; color: string; bg: string }> = ({ title, value, sub, icon, color, bg }) => (
  <div className={`${THEME.card} p-8 group bg-white border border-slate-100`}>
    <div className="flex items-center justify-between mb-4">
      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{title}</span>
      <div className={`w-10 h-10 rounded-2xl ${bg} ${color} flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-all`}><i className={`fa-solid ${icon}`}></i></div>
    </div>
    <h4 className="text-3xl font-black text-emerald-950 tracking-tighter">{value}</h4>
    <p className="text-[8px] font-bold text-slate-300 uppercase mt-2 tracking-widest">{sub}</p>
  </div>
);

const DetailBox: React.FC<{ label: string; value?: string; color?: string; bold?: boolean; full?: boolean }> = ({ label, value, color = "text-slate-800", bold, full }) => (
  <div className={`${full ? 'col-span-2' : ''}`}>
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">{label}</span>
    <p className={`text-sm ${bold ? 'font-black' : 'font-bold'} ${color} truncate`}>{value || '--'}</p>
  </div>
);

const BedCard: React.FC<{ bed: Bed; payers: Payer[]; onClick: () => void }> = ({ bed, payers, onClick }) => {
  const config = STATUS_CONFIG[bed.status];
  const age = calculateAge(bed.birthDate);
  const payerName = payers.find(p => p.id === bed.payerId)?.name;
  const isMismatch = bed.status === BedStatus.OCUPADO && bed.entitledCategory && bed.entitledCategory !== bed.category;

  return (
    <div onClick={onClick} className={`group p-8 rounded-[2.5rem] border-2 bg-white cursor-pointer transition-all hover:shadow-2xl ${isMismatch ? 'border-amber-300 shadow-amber-50' : config.border} relative overflow-hidden flex flex-col justify-between h-[360px]`}>
      <div>
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
             <span className="text-4xl font-black text-emerald-950 tracking-tighter">{bed.number}</span>
             <div className="flex flex-col">
               <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase tracking-widest">{bed.category}</span>
               {bed.admissionType && <span className={`text-[8px] font-black uppercase tracking-widest mt-1 ${bed.admissionType === 'CIRURGICO' ? 'text-rose-600' : 'text-emerald-700'}`}>{bed.admissionType}</span>}
             </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border ${config.bg} ${config.color} border-current/10 shadow-sm`}>{config.label}</div>
            {isMismatch && (
              <div className="flex items-center gap-1.5 bg-amber-500 text-white px-3 py-1.5 rounded-lg animate-pulse">
                <i className="fa-solid fa-triangle-exclamation text-[10px]"></i>
                <span className="text-[8px] font-black uppercase">Acomodação Divergente</span>
              </div>
            )}
          </div>
        </div>

        {bed.patientName ? (
          <div className="space-y-4">
            <div>
              <p className="text-lg font-black text-emerald-950 line-clamp-2 leading-tight uppercase tracking-tight">{bed.patientName}</p>
              <div className="flex items-center gap-3 mt-2">
                 <div className="flex flex-col">
                    <span className="text-[14px] font-black text-emerald-700">{age} <span className="text-[9px] uppercase opacity-50">anos</span></span>
                    <span className="text-[8px] font-bold text-slate-300 uppercase">{bed.birthDate ? new Date(bed.birthDate).toLocaleDateString('pt-BR') : '--'}</span>
                 </div>
                 {payerName && <span className="text-[9px] font-black text-indigo-500/60 uppercase border-l border-slate-100 pl-3 ml-1">{payerName}</span>}
              </div>
            </div>
            
            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Autorizado: <span className="text-emerald-800">{bed.entitledCategory}</span></p>
              <p className="text-[10px] font-black text-emerald-900 truncate"><i className="fa-solid fa-user-md mr-2 opacity-30"></i>{bed.doctorName || '--'}</p>
            </div>
          </div>
        ) : bed.status === BedStatus.BLOQUEADO ? (
          <div className="h-40 flex flex-col items-center justify-center opacity-20">
             <i className="fa-solid fa-ban text-6xl text-slate-400"></i>
             <p className="text-xs font-black uppercase mt-4">Bloqueado</p>
          </div>
        ) : bed.status === BedStatus.HIGIENIZACAO ? (
          <div className="h-40 flex flex-col items-center justify-center opacity-40 animate-pulse">
             <i className="fa-solid fa-soap text-6xl text-amber-400"></i>
             <p className="text-xs font-black uppercase mt-4 text-amber-600">Higienizando</p>
          </div>
        ) : (
          <div className="h-40 flex flex-col items-center justify-center opacity-[0.05] grayscale">
             <i className="fa-solid fa-bed-pulse text-6xl"></i>
             <p className="text-xs font-black uppercase mt-4">Disponível</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-6 border-t border-slate-50">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.bg} ${config.color} shadow-sm`}>{config.icon}</div>
        <div className="text-[8px] font-black text-emerald-800 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 tracking-widest uppercase">Gerenciar <i className="fa-solid fa-arrow-right ml-1"></i></div>
      </div>
    </div>
  );
};

export default App;
