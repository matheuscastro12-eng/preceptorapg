import { useState, useRef, useEffect } from 'react';
import PageSkeleton from '@/components/PageSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import { useAdmin } from '@/hooks/useAdmin';
import { useGenerationGuard } from '@/hooks/useGenerationGuard';
import InputPanel from '@/components/dashboard/InputPanel';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import ContextChat from '@/components/ContextChat';
import GenerationProgress from '@/components/GenerationProgress';
import SeminarActions from '@/components/dashboard/SeminarActions';
import { exportToPDF } from '@/utils/pdfExport';
import type { GenerationMode } from '@/components/dashboard/ModeToggle';
import OnboardingTour, { type TourStep } from '@/components/OnboardingTour';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Loader2, ArrowLeft, Save, Copy, Download, GraduationCap, BookOpen } from 'lucide-react';

type ViewMode = 'interactive' | 'document';

const MI = ({ name, fill = false, className = '' }: { name: string; fill?: boolean; className?: string }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontVariationSettings: fill ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : undefined }}
  >
    {name}
  </span>
);

/** Split markdown into sections by ## headings */
function splitIntoSections(markdown: string): { title: string; content: string }[] {
  const sections: { title: string; content: string }[] = [];
  const parts = markdown.split(/(?=^## )/m);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const headingMatch = trimmed.match(/^## (.+)/);
    if (headingMatch) {
      sections.push({
        title: headingMatch[1].trim(),
        content: trimmed,
      });
    } else {
      // Content before the first ## (intro)
      if (trimmed.length > 20) {
        sections.push({ title: '', content: trimmed });
      }
    }
  }

  return sections;
}

const dashboardTourSteps: TourStep[] = [
  { target: '[data-tour="tema-input"]',    title: 'Tema do Resumo',       description: 'Digite o tema central. Use os chips de sugestão ou escreva livremente.', placement: 'right' },
  { target: '[data-tour="objetivos-input"]', title: 'Objetivos (Opcional)', description: 'Liste objetivos específicos ou deixe em branco para a IA sugerir.', placement: 'right' },
  { target: '[data-tour="mode-toggle"]',   title: 'Tipo de Conteúdo',     description: 'Escolha entre Resumo (conteúdo focado) ou Seminário (apresentação completa).', placement: 'right' },
  { target: '[data-tour="generate-btn"]',  title: 'Gerar Conteúdo',       description: 'Clique para iniciar. O conteúdo aparecerá em tempo real no painel ao lado.', placement: 'right' },
];

interface RecentItem {
  id: string;
  tema: string;
  created_at: string;
  modo?: string;
}

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { hasAccess, loading: subLoading } = useSubscription();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { toast } = useToast();

  const [tema, setTema] = useState('');
  const [objetivos, setObjetivos] = useState('');
  const [modo, setModo] = useState<GenerationMode>('fechamento');
  const [resultado, setResultado] = useState('');
  const [generating, setGenerating] = useState(false);
  const [hasStartedReceiving, setHasStartedReceiving] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('interactive');
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const { canGenerate, cooldown } = useGenerationGuard(generating);

  useEffect(() => {
    if (hasStartedReceiving && !showResult) setShowResult(true);
  }, [hasStartedReceiving, showResult]);

  // Fetch recent items for sidebar
  useEffect(() => {
    if (!user) return;
    const fetchRecent = async () => {
      const { data } = await supabase
        .from('fechamentos')
        .select('id, tema, created_at')
        .order('created_at', { ascending: false })
        .limit(3);
      if (data) setRecentItems(data);
    };
    fetchRecent();
  }, [user]);

  if (authLoading || subLoading || adminLoading) return <PageSkeleton variant="dashboard" />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!hasAccess && !isAdmin) return <Navigate to="/pricing" replace />;

  const isSeminario = modo === 'seminario';

  const handleGenerate = async () => {
    if (!tema.trim()) {
      toast({ title: 'Tema obrigatório', description: 'Por favor, insira o tema central.', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    setResultado('');
    setHasStartedReceiving(false);
    setIsComplete(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada. Faça login novamente.');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-fechamento`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ tema, objetivos, modo }) }
      );
      if (!response.ok) { const e = await response.json().catch(() => ({})); throw new Error(e.error || 'Erro ao gerar fechamento'); }
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value, { stream: true }).split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) { if (!hasStartedReceiving) setHasStartedReceiving(true); fullText += content; setResultado(fullText); }
            } catch { /* partial */ }
          }
        }
      }
      setIsComplete(true);
    } catch (error) {
      toast({ title: 'Erro', description: error instanceof Error ? error.message : 'Não foi possível gerar. Tente novamente.', variant: 'destructive' });
    } finally { setGenerating(false); }
  };

  const handleCopy = () => {
    const clean = resultado.replace(/^#{1,6}\s+/gm,'').replace(/\*\*\*(.*?)\*\*\*/g,'$1').replace(/\*\*(.*?)\*\*/g,'$1').replace(/\*(.*?)\*/g,'$1').replace(/`{1,3}(.*?)`{1,3}/gs,'$1').replace(/^\s*[-*+]\s+/gm,'• ').replace(/^>\s+/gm,'').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/^---+$/gm,'').replace(/\n{3,}/g,'\n\n');
    navigator.clipboard.writeText(clean.trim());
    toast({ title: 'Copiado!', description: 'Resumo copiado para a área de transferência.' });
  };

  const handleExportPDF = async () => {
    const el = viewMode === 'document' ? docRef.current : resultRef.current;
    if (!el || !resultado) return;
    setExporting(true);
    try { await exportToPDF({ tema: tema.trim(), contentElement: el }); toast({ title: 'PDF exportado!' }); }
    catch { toast({ title: 'Erro ao exportar', variant: 'destructive' }); }
    finally { setExporting(false); }
  };

  const handleSave = async () => {
    if (!resultado || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('fechamentos').insert({ user_id: user.id, tema: tema.trim(), objetivos: objetivos.trim() || null, resultado });
      if (error) throw error;
      toast({ title: 'Salvo!', description: 'Resumo salvo na sua biblioteca.' });
    } catch { toast({ title: 'Erro ao salvar', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const handleGenerateExam = async () => {
    if (!resultado || !user) return;
    try {
      const { error } = await supabase.from('fechamentos').insert({ user_id: user.id, tema: tema.trim(), objetivos: objetivos.trim() || null, resultado }).select('id').single();
      if (error) throw error;
      toast({ title: 'Salvo!', description: 'Redirecionando para o Modo Prática...' });
      navigate('/exam');
    } catch { toast({ title: 'Erro ao salvar', variant: 'destructive' }); }
  };

  const showActions = resultado && !generating;
  const readingTime = resultado ? Math.max(1, Math.ceil(resultado.split(/\s+/).length / 200)) : 0;

  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      return `Hoje, às ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    if (diffDays === 1) return `Ontem, às ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${date.getDate().toString().padStart(2, '0')} ${months[date.getMonth()]}, ${date.getFullYear()}`;
  };

  return (
    <DashboardLayout mainClassName="pb-8 px-4 sm:px-8">
      <OnboardingTour steps={dashboardTourSteps} tourKey="dashboard" />

      <div className="max-w-5xl mx-auto w-full">
        {showResult ? (
          <>
            {/* ── Page Header ── */}
            <div className="mb-6 sm:mb-10">
              <div className="flex items-center gap-2 text-[#006D5B] font-semibold mb-2 sm:mb-3">
                <MI name="auto_awesome" fill className="text-[16px]" />
                <span className="text-[11px] uppercase tracking-widest font-bold">
                  {isSeminario ? 'Roteiro de Seminário' : 'AI Summary Insight'}
                </span>
              </div>
              <h1 className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-[#191c1d] tracking-tight mb-3 sm:mb-4 font-['Manrope']">
                {tema}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 bg-[#c8eade] text-[#4c6a62] text-[11px] font-bold rounded-full uppercase">
                  {isSeminario ? 'Seminário' : 'Resumo'}
                </span>
                {isComplete && (
                  <span className="px-3 py-1 bg-[#9df3dc] text-[#005143] text-[11px] font-bold rounded-full uppercase">
                    Tempo de Leitura: {readingTime} min
                  </span>
                )}
                {generating && (
                  <span className="px-3 py-1 bg-[#e7e8e9] text-[#3e4945] text-[11px] font-bold rounded-full uppercase flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#006D5B] animate-pulse" />
                    Gerando...
                  </span>
                )}
              </div>
            </div>

            {/* ── Toolbar ── */}
            <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowResult(false)}
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#006D5B] transition-colors active:scale-95"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Novo Resumo</span>
                </button>

                {/* View mode toggle */}
                <div className="flex items-center gap-0.5 bg-[#f3f4f5] rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode('interactive')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'interactive' ? 'bg-white shadow-sm text-[#006D5B]' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <MI name="auto_awesome" className="text-[16px]" />
                    <span className="hidden sm:inline">Estudo Interativo</span>
                  </button>
                  <button
                    onClick={() => setViewMode('document')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'document' ? 'bg-white shadow-sm text-[#006D5B]' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <MI name="description" className="text-[16px]" />
                    <span className="hidden sm:inline">Documento</span>
                  </button>
                </div>
              </div>

              {showActions && (
                <div className="flex items-center gap-1.5">
                  {[
                    { icon: saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />, label: 'Salvar', onClick: handleSave, disabled: saving },
                    { icon: <Copy className="h-4 w-4" />, label: 'Copiar', onClick: handleCopy, disabled: false },
                    { icon: exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />, label: 'PDF', onClick: handleExportPDF, disabled: exporting },
                  ].map(({ icon, label, onClick, disabled }) => (
                    <button
                      key={label}
                      onClick={onClick}
                      disabled={disabled}
                      className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium text-slate-500 hover:text-[#191c1d] hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200/60 transition-all duration-200 active:scale-95 disabled:opacity-50"
                    >
                      {icon}
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Content ── */}
            {viewMode === 'interactive' ? (
              /* ═══ INTERACTIVE VIEW — Section Cards ═══ */
              <div className="grid grid-cols-12 gap-4 sm:gap-6 lg:gap-8">
                {/* Main Article Column */}
                <div className="col-span-12 lg:col-span-8 space-y-4 sm:space-y-6" ref={resultRef}>
                  {/* Split into section cards */}
                  {(() => {
                    const sections = splitIntoSections(resultado);
                    if (sections.length <= 1) {
                      return (
                        <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl shadow-sm border-l-4 border-[#006D5B] animate-fade-up">
                          <MarkdownRenderer content={resultado} isTyping={generating && resultado.length > 0} variant="rich" />
                        </div>
                      );
                    }
                    return sections.map((section, i) => (
                      <div
                        key={i}
                        className={`bg-white p-4 sm:p-6 md:p-8 rounded-2xl shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 animate-fade-up ${
                          i === 0 ? 'border-l-4 border-[#006D5B]' : 'border border-slate-100/60'
                        }`}
                        style={{ animationDelay: `${i * 0.08}s` }}
                      >
                        <MarkdownRenderer
                          content={section.content}
                          isTyping={generating && i === sections.length - 1 && resultado.length > 0}
                          variant="rich"
                        />
                      </div>
                    ));
                  })()}

                  {/* Disclaimer */}
                  {!generating && resultado && (
                    <p className="text-[10px] text-slate-400 leading-relaxed px-2">
                      Conteúdo gerado por IA para fins educacionais. Pode conter imprecisões — valide com fontes primárias. Não substitui orientação médica. (CFM 2.338/2023)
                    </p>
                  )}

                  {/* Seminar actions */}
                  {showActions && isSeminario && (
                    <SeminarActions resultado={resultado} tema={tema} />
                  )}
                </div>

                {/* Sidebar Column */}
                <div className="col-span-12 lg:col-span-4">
                  <div className="lg:sticky lg:top-24 space-y-6">
                    {/* Clinical Pearls Card */}
                    <div className="bg-[#005344] p-4 sm:p-6 rounded-2xl text-white shadow-xl relative overflow-hidden group hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-500 animate-fade-up" style={{ animationDelay: '0.1s' }}>
                      <div className="absolute -right-4 -top-4 opacity-10 pointer-events-none group-hover:opacity-20 group-hover:scale-110 transition-all duration-700">
                        <MI name="diamond" className="text-[80px]" />
                      </div>
                      <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-[#9df3dc]/8 rounded-full blur-2xl group-hover:bg-[#9df3dc]/12 transition-all duration-700" />
                      <div className="flex items-center gap-2 mb-4 relative z-10">
                        <MI name="diamond" fill className="text-[20px]" />
                        <h3 className="text-base font-bold font-['Manrope']">Pérolas Clínicas</h3>
                      </div>
                      <div className="space-y-4 relative z-10">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-[#96ebd5] tracking-widest mb-1">Atenção Médica</p>
                          <p className="text-sm leading-relaxed text-[#9df3dc]">
                            Use o chat do Preceptor para extrair pérolas clínicas, dicas de prova e aprofundar nos pontos-chave deste resumo.
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-[#96ebd5] tracking-widest mb-1">Dica de Prova</p>
                          <p className="text-sm leading-relaxed text-[#9df3dc]">
                            Pergunte ao Preceptor AI quais pontos mais caem em provas sobre este tema.
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-[#96ebd5] tracking-widest mb-1">Manejo</p>
                          <p className="text-sm leading-relaxed text-[#9df3dc]">
                            Gere simulados a partir deste conteúdo para consolidar o aprendizado com active recall.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Progress Card */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 animate-fade-up" style={{ animationDelay: '0.2s' }}>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Seu Progresso</h4>
                        {isComplete && <span className="text-xs font-bold text-[#006D5B]">+15 XP</span>}
                      </div>
                      {generating ? (
                        <GenerationProgress
                          isGenerating={generating}
                          hasStartedReceiving={hasStartedReceiving}
                          isComplete={isComplete}
                        />
                      ) : isComplete ? (
                        <div>
                          <div className="w-full bg-[#e7e8e9] h-2 rounded-full mb-2 overflow-hidden">
                            <div className="bg-[#006D5B] h-full w-full transition-all duration-500" />
                          </div>
                          <div className="flex justify-between text-[10px] font-bold text-slate-500">
                            <span>100% CONCLUÍDO</span>
                            <span className="text-[#006D5B]">Pronto</span>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="w-full bg-[#e7e8e9] h-2 rounded-full mb-2 overflow-hidden">
                            <div className="bg-[#006D5B] h-full transition-all duration-500" style={{ width: '65%' }} />
                          </div>
                          <div className="flex justify-between text-[10px] font-bold text-slate-500">
                            <span>65% CONCLUÍDO</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Dúvidas prompt */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-[#006D5B]/20 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group animate-fade-up" style={{ animationDelay: '0.3s' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#006D5B]/10 flex items-center justify-center group-hover:bg-[#006D5B]/15 group-hover:scale-105 transition-all duration-300">
                          <MI name="chat_bubble" fill className="text-[16px] text-[#006D5B]" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase text-[#006D5B] tracking-wider">Dúvidas Clínicas?</p>
                          <p className="text-[10px] text-slate-500">Pergunte ao Preceptor AI agora.</p>
                        </div>
                        <MI name="arrow_forward" className="text-[16px] text-slate-300 ml-auto group-hover:text-[#006D5B] group-hover:translate-x-0.5 transition-all duration-200" />
                      </div>
                    </div>

                    {/* Generate Exam Button */}
                    {showActions && (
                      <button
                        onClick={handleGenerateExam}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border-2 border-[#006D5B]/20 text-[#005344] rounded-xl text-sm font-bold hover:bg-[#006D5B]/5 hover:border-[#006D5B]/40 hover:shadow-sm transition-all duration-200 active:scale-[0.98]"
                      >
                        <GraduationCap className="h-5 w-5" />
                        Gerar Simulado a partir deste Resumo
                      </button>
                    )}

                    {/* Library link */}
                    {showActions && (
                      <button
                        onClick={() => navigate('/library')}
                        className="w-full flex items-center justify-center gap-2 py-3 text-xs font-medium text-slate-500 hover:text-[#006D5B] transition-colors"
                      >
                        <BookOpen className="h-4 w-4" />
                        Ver na Biblioteca
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* ═══ DOCUMENT VIEW ═══ */
              <div className="max-w-4xl mx-auto">
                <div
                  ref={docRef}
                  className="bg-white rounded-xl shadow-sm border border-slate-200/30 p-8 sm:p-12"
                >
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#191c1d] mb-2 font-['Manrope']">
                    {tema}
                  </h1>
                  <div className="flex flex-wrap gap-2 mb-8 pb-6 border-b border-slate-200/60">
                    <span className="px-3 py-1 bg-[#c8eade] text-[#4c6a62] text-[11px] font-bold rounded-full uppercase">
                      {isSeminario ? 'Seminário' : 'Resumo'}
                    </span>
                    {isComplete && (
                      <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[11px] font-bold rounded-full uppercase">
                        {readingTime} min de leitura
                      </span>
                    )}
                  </div>

                  <div className="prose prose-sm max-w-none prose-headings:text-[#191c1d]">
                    <MarkdownRenderer content={resultado} isTyping={generating && resultado.length > 0} />
                  </div>
                </div>

                {/* Disclaimer */}
                {!generating && resultado && (
                  <p className="text-[10px] text-slate-400 leading-relaxed px-2 mt-4">
                    Conteúdo gerado por IA para fins educacionais. Pode conter imprecisões — valide com fontes primárias. Não substitui orientação médica. (CFM 2.338/2023)
                  </p>
                )}

                {/* Seminar actions */}
                {showActions && isSeminario && (
                  <div className="mt-6">
                    <SeminarActions resultado={resultado} tema={tema} />
                  </div>
                )}
              </div>
            )}

            {/* ContextChat FAB */}
            {resultado && (
              <ContextChat
                context={resultado}
                contextLabel="resumo"
                suggestions={[
                  'Quais são as pérolas clínicas deste tema?',
                  'O que mais cai em prova sobre isso?',
                  'Explique a fisiopatologia em detalhes',
                  'Quais são os diagnósticos diferenciais?',
                ]}
              />
            )}
          </>
        ) : (
          /* ══════════════════════════════════════════════
             INPUT FORM STATE — Bento Grid Layout
             ══════════════════════════════════════════════ */
          <div className="relative">
            {/* Floating background orbs */}
            <div className="absolute -top-20 -left-20 w-72 h-72 bg-[#9df3dc]/15 rounded-full blur-3xl pointer-events-none animate-float" />
            <div className="absolute top-40 -right-16 w-56 h-56 bg-[#006D5B]/8 rounded-full blur-3xl pointer-events-none" style={{ animation: 'float 6s ease-in-out infinite reverse' }} />

            {/* Hero Title Section */}
            <div className="mt-2 sm:mt-6 mb-8 sm:mb-10 text-center relative z-10 animate-fade-up">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#c8eade] text-[#4c6a62] text-xs font-bold mb-5 hover:bg-[#9df3dc] hover:scale-105 transition-all duration-300 cursor-default">
                <MI name="auto_awesome" fill className="text-[16px]" />
                INTELIGÊNCIA ARTIFICIAL
              </span>
              <h2 className="font-['Manrope'] font-extrabold text-2xl sm:text-4xl lg:text-5xl text-[#191c1d] tracking-tighter mb-3 sm:mb-4">
                O que deseja estudar?
              </h2>
              <p className="text-[#3e4945] text-sm sm:text-base lg:text-lg max-w-2xl mx-auto font-medium px-2">
                Gere resumos estruturados e roteiros de seminário com inteligência artificial
                para otimizar sua prática clínica.
              </p>
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-12 gap-4 sm:gap-6 relative z-10">
              {/* Main Form Card — 8 cols */}
              <div className="col-span-12 lg:col-span-8 animate-fade-up" style={{ animationDelay: '0.1s' }}>
                <InputPanel
                  tema={tema}
                  setTema={setTema}
                  objetivos={objetivos}
                  setObjetivos={setObjetivos}
                  modo={modo}
                  setModo={setModo}
                  generating={generating}
                  hasStartedReceiving={hasStartedReceiving}
                  isComplete={isComplete}
                  onGenerate={handleGenerate}
                  canGenerate={canGenerate}
                  cooldown={cooldown}
                />
              </div>

              {/* Sidebar — 4 cols */}
              <div className="col-span-12 lg:col-span-4 space-y-4 sm:space-y-6 animate-fade-up" style={{ animationDelay: '0.2s' }}>
                {/* AI Insight / Dica de Curadoria Card */}
                <div className="relative overflow-hidden p-5 sm:p-8 rounded-2xl bg-[#005344] text-white shadow-xl group hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-500">
                  <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 group-hover:scale-110 transition-all duration-700" />
                  <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-[#9df3dc]/10 rounded-full blur-2xl group-hover:bg-[#9df3dc]/15 transition-all duration-700" />
                  <div className="relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center mb-4 group-hover:bg-white/20 group-hover:scale-110 transition-all duration-300">
                      <MI name="lightbulb" fill className="text-[24px]" />
                    </div>
                    <h3 className="font-['Manrope'] font-bold text-xl mb-3">Dica de Curadoria</h3>
                    <p className="text-sm text-white/80 leading-relaxed font-medium">
                      "Quanto mais específico o seu objetivo, melhor a IA conseguirá estruturar as diretrizes mais recentes da Sociedade Brasileira de Cardiologia."
                    </p>
                  </div>
                </div>

                {/* Recent Items Card */}
                <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-[#006D5B]/10 transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-['Manrope'] font-bold text-[#191c1d]">Gerados Recentemente</h3>
                    <MI name="history" className="text-[18px] text-[#006D5B]/40" />
                  </div>
                  {recentItems.length > 0 ? (
                    <div className="space-y-3">
                      {recentItems.map((item, i) => (
                        <button
                          key={item.id}
                          onClick={() => navigate('/library')}
                          className="flex items-center gap-3 group w-full text-left p-2 -mx-2 rounded-xl hover:bg-[#f3f4f5] transition-all duration-200"
                          style={{ animationDelay: `${0.3 + i * 0.06}s` }}
                        >
                          <div className="w-10 h-10 rounded-xl bg-[#f3f4f5] flex items-center justify-center text-[#005344] group-hover:bg-[#005344] group-hover:text-white group-hover:scale-105 transition-all duration-300 shadow-sm">
                            <MI name="description" className="text-[18px]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-[#191c1d] truncate group-hover:text-[#005344] transition-colors duration-200">{item.tema}</p>
                            <p className="text-[10px] text-[#6e7975]">{formatRelativeDate(item.created_at)}</p>
                          </div>
                          <MI name="chevron_right" className="text-[16px] text-slate-300 group-hover:text-[#006D5B] group-hover:translate-x-0.5 transition-all duration-200" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <MI name="library_books" className="text-[32px] text-slate-200 mb-2 block mx-auto" />
                      <p className="text-xs text-[#6e7975]">Nenhum resumo gerado ainda.</p>
                    </div>
                  )}
                  <button
                    onClick={() => navigate('/library')}
                    className="w-full mt-5 py-2.5 text-xs font-bold text-[#005344] uppercase tracking-widest border border-[#005344]/15 rounded-xl hover:bg-[#005344]/5 hover:border-[#005344]/30 transition-all duration-300 active:scale-95"
                  >
                    Ver Biblioteca
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
