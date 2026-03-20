import { useState, useRef, useMemo } from 'react';

import PageSkeleton from '@/components/PageSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useAdmin } from '@/hooks/useAdmin';
import { useToast } from '@/hooks/use-toast';
import { useEnamedBank, type EnamedArea, AREA_LABELS } from '@/hooks/useEnamedBank';
import { useEnamedGenerator } from '@/hooks/useEnamedGenerator';
import { Navigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import EnamedBankSimulation from '@/components/enamed/EnamedBankSimulation';
import SimulationView from '@/components/exam/SimulationView';
import GenerationProgress from '@/components/GenerationProgress';
import ContextChat from '@/components/ContextChat';
import DashboardLayout from '@/components/layout/DashboardLayout';

type EnamedMode = 'menu' | 'completo' | 'revisao' | 'ia_completo' | 'ia_area';
type EnamedSource = 'banco' | 'ia';

const MI = ({ name, fill = false, className = '' }: { name: string; fill?: boolean; className?: string }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontVariationSettings: fill ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : undefined }}
  >
    {name}
  </span>
);

const AREA_OPTIONS: { value: EnamedArea; label: string; icon: string }[] = [
  { value: 'clinica_medica', label: 'Clínica Médica', icon: 'cardiology' },
  { value: 'cirurgia', label: 'Cirurgia', icon: 'surgical' },
  { value: 'ginecologia_obstetricia', label: 'GO', icon: 'pregnant_woman' },
  { value: 'pediatria', label: 'Pediatria', icon: 'child_care' },
  { value: 'saude_coletiva', label: 'Saúde Coletiva', icon: 'groups' },
];

const Enamed = () => {
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading: subLoading } = useSubscription();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { toast } = useToast();
  const resultRef = useRef<HTMLDivElement>(null);

  const { questions, loading: bankLoading, fetchQuestions, saveAttempt } = useEnamedBank();
  const { resultado, generating, hasStartedReceiving, isComplete, generate, reset } = useEnamedGenerator();

  const [mode, setMode] = useState<EnamedMode>('menu');
  const [selectedArea, setSelectedArea] = useState<EnamedArea | null>(null);
  const [source, setSource] = useState<EnamedSource>('banco');
  const [showIaSimulation, setShowIaSimulation] = useState(false);

  const bankQuestionsContext = useMemo(() => {
    if (!questions || questions.length === 0) return '';
    return questions.map((q, i) => {
      return `## Questão ${i + 1} (${AREA_LABELS[q.area] || q.area} — ENAMED ${q.ano})\n\n${q.enunciado}\n\n**A)** ${q.alternativa_a}\n**B)** ${q.alternativa_b}\n**C)** ${q.alternativa_c}\n**D)** ${q.alternativa_d}\n\n**Gabarito:** ${q.gabarito}${q.explicacao ? `\n**Explicação:** ${q.explicacao}` : ''}`;
    }).join('\n\n---\n\n');
  }, [questions]);

  const enamedChatSuggestions = useMemo(() => [
    'Por que a alternativa correta está certa?',
    'Quais são os diagnósticos diferenciais?',
    'Explique a fisiopatologia envolvida',
    'Que pegadinhas comuns caem sobre esse tema?',
  ], []);

  if (authLoading || subLoading || adminLoading) return <PageSkeleton variant="exam" />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!hasAccess && !isAdmin) return <Navigate to="/pricing" replace />;

  const startBankMode = async (m: 'completo' | 'revisao', area?: EnamedArea) => {
    setSource('banco');
    setMode(m);
    setSelectedArea(area || null);

    const opts: { area?: EnamedArea; limit?: number; shuffle?: boolean } = {};
    if (m === 'revisao') { opts.shuffle = true; opts.limit = 20; }
    await fetchQuestions(opts);
  };

  const startIaMode = async (m: 'ia_completo' | 'ia_area', area?: EnamedArea) => {
    setSource('ia');
    setMode(m);
    setSelectedArea(area || null);
    setShowIaSimulation(false);
    reset();
    await generate({
      quantidade: m === 'ia_completo' ? 50 : 20,
      area: area || undefined,
    });
  };

  const handleFinishBank = (score: { correct: number; total: number; percentage: number; answers: Record<string, string> }) => {
    saveAttempt({
      modo: mode === 'completo' ? 'completo' : 'revisao',
      area_filter: selectedArea || undefined,
      total_questions: score.total,
      correct_answers: score.correct,
      percentage: score.percentage,
      answers: score.answers,
      source: 'banco',
    });
    toast({ title: 'Resultado salvo!', description: `${score.percentage}% de acerto — ${score.correct}/${score.total}` });
  };

  const handleBackToMenu = () => {
    setMode('menu');
    setSelectedArea(null);
    reset();
    setShowIaSimulation(false);
  };

  const hasIaQuestions = resultado && resultado.includes('## Questão');
  const isSimulationMode = source === 'banco' && (mode === 'completo' || mode === 'revisao');
  const isIaMode = mode === 'ia_completo' || mode === 'ia_area';

  return (
    <DashboardLayout mainClassName="pb-4 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">

        {/* Menu */}
        {mode === 'menu' && (
          <div className="relative">
            {/* Background orbs */}
            <div className="absolute -top-16 -right-20 w-72 h-72 bg-[#9df3dc]/12 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-60 -left-16 w-48 h-48 bg-[#006D5B]/6 rounded-full blur-3xl pointer-events-none animate-float" />

            <div className="mb-10 relative z-10 animate-fade-up">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#c8eade] text-[#4c6a62] text-xs font-bold mb-4">
                <MI name="history_edu" className="text-[14px]" />
                PREPARATÓRIO
              </span>
              <h1
                className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#191c1d] mb-2"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                ENAMED Preparatório
              </h1>
              <p className="text-sm sm:text-base text-[#3e4945] max-w-2xl leading-relaxed">
                Questões no padrão INEP — vinhetas clínicas, raciocínio diagnóstico e conduta.
              </p>
            </div>

            <div className="max-w-5xl space-y-12 relative z-10">
              {/* Banco Section */}
              <section className="animate-fade-up" style={{ animationDelay: '0.08s' }}>
                <div className="flex items-center gap-3 mb-6">
                  <span className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-500 text-white text-sm font-bold shadow-lg shadow-amber-500/20">
                    <MI name="database" className="text-[18px]" />
                  </span>
                  <h2 className="font-['Manrope'] text-xl font-bold text-[#191c1d]">Banco de Questões ENAMED</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <button
                    onClick={() => startBankMode('completo')}
                    className="group text-left disabled:opacity-50"
                  >
                    <div className="relative p-4 sm:p-7 rounded-2xl border-2 border-amber-200/60 bg-white transition-all duration-300 group-hover:border-amber-300 group-hover:shadow-lg group-hover:-translate-y-0.5 group-active:scale-[0.98]">
                      <div className="w-14 h-14 rounded-xl bg-amber-50 flex items-center justify-center mb-4 group-hover:bg-amber-100 group-hover:scale-105 transition-all duration-300">
                        <MI name="assignment" className="text-[28px] text-amber-600" />
                      </div>
                      <h3 className="font-['Manrope'] text-lg font-bold text-[#191c1d] mb-2">Simulado Completo</h3>
                      <p className="text-sm text-[#3e4945] leading-relaxed">Todas as questões do banco, todas as áreas</p>
                      <div className="flex items-center gap-1.5 mt-4 text-amber-600 text-xs font-bold uppercase tracking-wider">
                        Iniciar
                        <MI name="arrow_forward" className="text-[16px] group-hover:translate-x-1 transition-transform duration-200" />
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => startBankMode('revisao')}
                    className="group text-left disabled:opacity-50"
                  >
                    <div className="relative p-4 sm:p-7 rounded-2xl border-2 border-slate-200/60 bg-white transition-all duration-300 group-hover:border-[#006D5B]/30 group-hover:shadow-lg group-hover:-translate-y-0.5 group-active:scale-[0.98]">
                      <div className="w-14 h-14 rounded-xl bg-[#f3f4f5] flex items-center justify-center mb-4 group-hover:bg-[#c8eade] group-hover:scale-105 transition-all duration-300">
                        <MI name="shuffle" className="text-[28px] text-[#6e7975] group-hover:text-[#005344] transition-colors duration-300" />
                      </div>
                      <h3 className="font-['Manrope'] text-lg font-bold text-[#191c1d] mb-2">Revisão Rápida</h3>
                      <p className="text-sm text-[#3e4945] leading-relaxed">20 questões aleatórias para treino rápido</p>
                      <div className="flex items-center gap-1.5 mt-4 text-[#006D5B] text-xs font-bold uppercase tracking-wider">
                        Iniciar
                        <MI name="arrow_forward" className="text-[16px] group-hover:translate-x-1 transition-transform duration-200" />
                      </div>
                    </div>
                  </button>
                </div>
              </section>

              {/* IA Section */}
              <section className="animate-fade-up" style={{ animationDelay: '0.16s' }}>
                <div className="flex items-center gap-3 mb-6">
                  <span className="flex items-center justify-center w-9 h-9 rounded-full bg-[#006d5b] text-white text-sm font-bold shadow-lg shadow-[#006d5b]/20">
                    <MI name="auto_awesome" className="text-[18px]" />
                  </span>
                  <h2 className="font-['Manrope'] text-xl font-bold text-[#191c1d]">Questões Geradas por IA</h2>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold text-white bg-[#005344] uppercase tracking-wider">Novo</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <button
                    onClick={() => startIaMode('ia_completo')}
                    className="group text-left disabled:opacity-50"
                  >
                    <div className="relative p-4 sm:p-7 rounded-2xl border-2 border-[#006D5B]/15 bg-white transition-all duration-300 group-hover:border-[#006D5B]/30 group-hover:shadow-lg group-hover:-translate-y-0.5 group-active:scale-[0.98]">
                      <div className="w-14 h-14 rounded-xl bg-[#c8eade] flex items-center justify-center mb-4 group-hover:bg-[#9df3dc] group-hover:scale-105 transition-all duration-300">
                        <MI name="psychology" className="text-[28px] text-[#005344]" />
                      </div>
                      <h3 className="font-['Manrope'] text-lg font-bold text-[#191c1d] mb-2">Simulado IA (50q)</h3>
                      <p className="text-sm text-[#3e4945] leading-relaxed">Todas as áreas — questões inéditas geradas por IA</p>
                      <div className="flex items-center gap-1.5 mt-4 text-[#006D5B] text-xs font-bold uppercase tracking-wider">
                        Gerar
                        <MI name="arrow_forward" className="text-[16px] group-hover:translate-x-1 transition-transform duration-200" />
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setMode('ia_area')}
                    className="group text-left disabled:opacity-50"
                  >
                    <div className="relative p-4 sm:p-7 rounded-2xl border-2 border-slate-200/60 bg-white transition-all duration-300 group-hover:border-[#006D5B]/30 group-hover:shadow-lg group-hover:-translate-y-0.5 group-active:scale-[0.98]">
                      <div className="w-14 h-14 rounded-xl bg-[#f3f4f5] flex items-center justify-center mb-4 group-hover:bg-[#c8eade] group-hover:scale-105 transition-all duration-300">
                        <MI name="target" className="text-[28px] text-[#6e7975] group-hover:text-[#005344] transition-colors duration-300" />
                      </div>
                      <h3 className="font-['Manrope'] text-lg font-bold text-[#191c1d] mb-2">Por Área</h3>
                      <p className="text-sm text-[#3e4945] leading-relaxed">Foque em uma especialidade — 20 questões IA</p>
                      <div className="flex items-center gap-1.5 mt-4 text-[#006D5B] text-xs font-bold uppercase tracking-wider">
                        Escolher
                        <MI name="arrow_forward" className="text-[16px] group-hover:translate-x-1 transition-transform duration-200" />
                      </div>
                    </div>
                  </button>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* Area Selection */}
        {mode === 'ia_area' && !generating && !resultado && (
          <div className="relative">
            <div className="absolute -top-10 -right-16 w-56 h-56 bg-[#9df3dc]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center gap-3 mb-8 animate-fade-up">
              <button onClick={handleBackToMenu} className="flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-[#006D5B] transition-colors active:scale-95">
                <ArrowLeft className="h-4 w-4" /> ENAMED
              </button>
              <div className="h-4 w-px bg-slate-200" />
              <span className="text-sm font-semibold text-[#191c1d]">Escolha a Área</span>
            </div>

            <div className="mb-8 animate-fade-up" style={{ animationDelay: '0.05s' }}>
              <h2 className="font-['Manrope'] text-2xl font-bold text-[#191c1d] mb-2">Selecione a Especialidade</h2>
              <p className="text-sm text-[#3e4945]">20 questões inéditas geradas por IA na área escolhida.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl">
              {AREA_OPTIONS.map(({ value, label, icon }, i) => (
                <button
                  key={value}
                  onClick={() => startIaMode('ia_area', value)}
                  className="group animate-fade-up"
                  style={{ animationDelay: `${0.1 + i * 0.06}s` }}
                >
                  <div className="rounded-2xl border-2 border-slate-200/60 bg-white p-6 text-left transition-all duration-300 group-hover:border-[#006D5B]/30 group-hover:shadow-lg group-hover:-translate-y-1 group-active:scale-[0.98]">
                    <div className="w-14 h-14 rounded-xl bg-[#c8eade] flex items-center justify-center mb-4 group-hover:bg-[#9df3dc] group-hover:scale-110 transition-all duration-300">
                      <MI name={icon} className="text-[28px] text-[#005344]" />
                    </div>
                    <h3 className="font-['Manrope'] text-base font-bold text-[#191c1d] mb-1">{label}</h3>
                    <p className="text-xs text-[#6e7975]">20 questões IA</p>
                    <div className="flex items-center gap-1 mt-3 text-[#006D5B] text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      Começar <MI name="arrow_forward" className="text-[14px]" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bank Simulation */}
        {isSimulationMode && (
          <>
            <div className="flex items-center gap-3 mb-4 animate-fade-up">
              <button onClick={handleBackToMenu} className="flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-[#006D5B] transition-colors active:scale-95">
                <ArrowLeft className="h-4 w-4" /> ENAMED
              </button>
              <div className="h-4 w-px bg-slate-200" />
              <span className="text-sm font-semibold text-[#191c1d]">
                {mode === 'completo' ? 'Simulado Completo' : 'Revisão Rápida'}
              </span>
            </div>
            <div className="flex flex-col lg:flex-row gap-4 min-h-[50vh] lg:h-[calc(100vh-10rem)]">
              <div className="flex-1 min-w-0 rounded-2xl bg-white border border-slate-100 shadow-[0_8px_32px_0_rgba(44,52,52,0.06)] p-4 sm:p-6 flex flex-col overflow-hidden">
                <EnamedBankSimulation
                  questions={questions}
                  onFinish={handleFinishBank}
                  onExit={handleBackToMenu}
                  loading={bankLoading}
                />
              </div>
              {bankQuestionsContext && (
                <ContextChat
                  context={bankQuestionsContext}
                  contextLabel="simulado ENAMED"
                  suggestions={enamedChatSuggestions}
                />
              )}
            </div>
          </>
        )}

        {/* IA Generation Mode */}
        {isIaMode && (generating || resultado) && (
          <>
            <div className="flex items-center gap-3 mb-4 animate-fade-up">
              <button onClick={handleBackToMenu} className="flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-[#006D5B] transition-colors active:scale-95">
                <ArrowLeft className="h-4 w-4" /> ENAMED
              </button>
              <div className="h-4 w-px bg-slate-200" />
              <span className="text-sm font-semibold text-[#191c1d]">
                ENAMED IA {selectedArea ? `— ${AREA_LABELS[selectedArea]}` : '— Simulado'}
              </span>
            </div>
            <div className="flex flex-col lg:flex-row gap-4 min-h-[50vh] lg:h-[calc(100vh-10rem)]">
              <div className="flex-1 min-w-0 rounded-2xl bg-white border border-slate-100 shadow-[0_8px_32px_0_rgba(44,52,52,0.06)] p-4 sm:p-6 flex flex-col overflow-hidden">
                {showIaSimulation && hasIaQuestions ? (
                  <SimulationView
                    resultado={resultado}
                    onExit={() => setShowIaSimulation(false)}
                    isGenerating={generating}
                    isComplete={isComplete}
                  />
                ) : (
                  <>
                    {generating && (
                      <div className="flex flex-col items-center justify-center h-full py-16 text-center space-y-6 max-w-md mx-auto">
                        <div className="w-16 h-16 rounded-2xl bg-[#c8eade] flex items-center justify-center mb-2 animate-pulse">
                          <MI name="psychology" className="text-[32px] text-[#005344]" />
                        </div>
                        <div className="space-y-2">
                          <p className="font-['Manrope'] text-lg font-bold text-[#191c1d]">
                            Gerando questões ENAMED...
                          </p>
                          <p className="text-sm text-[#6e7975]">
                            {hasStartedReceiving
                              ? 'Recebendo conteúdo — as questões aparecerão automaticamente.'
                              : 'Conectando com a IA, aguarde um momento.'}
                          </p>
                        </div>
                        <div className="w-full max-w-xs">
                          <GenerationProgress
                            isGenerating={generating}
                            hasStartedReceiving={hasStartedReceiving}
                            isComplete={isComplete}
                          />
                        </div>
                      </div>
                    )}

                    {isComplete && hasIaQuestions && !showIaSimulation && (
                      <div className="flex flex-col items-center justify-center h-full py-16 text-center space-y-6 max-w-md mx-auto animate-scale-up">
                        <div className="w-16 h-16 rounded-2xl bg-[#9df3dc] flex items-center justify-center">
                          <MI name="check_circle" fill className="text-[32px] text-[#005344]" />
                        </div>
                        <div className="space-y-2">
                          <p className="font-['Manrope'] text-lg font-bold text-[#191c1d]">
                            Questões prontas!
                          </p>
                          <p className="text-sm text-[#6e7975]">
                            Clique abaixo para iniciar o simulado.
                          </p>
                        </div>
                        <button
                          onClick={() => setShowIaSimulation(true)}
                          className="btn-shimmer relative overflow-hidden px-8 py-4 rounded-xl font-['Manrope'] font-bold text-white flex items-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
                          style={{ background: 'linear-gradient(135deg, #005344, #006d5b)' }}
                        >
                          <MI name="play_arrow" fill className="text-[22px]" />
                          Entrar no Modo Simulação
                        </button>
                      </div>
                    )}

                    {isComplete && !hasIaQuestions && (
                      <div className="flex flex-col items-center justify-center h-full py-16 text-center space-y-4 max-w-md mx-auto">
                        <MI name="error_outline" className="text-[40px] text-slate-300" />
                        <p className="text-sm text-[#6e7975]">Não foi possível gerar questões. Tente novamente.</p>
                        <button
                          onClick={handleBackToMenu}
                          className="px-6 py-2.5 text-sm font-bold text-[#005344] border border-[#005344]/20 rounded-xl hover:bg-[#005344]/5 transition-all duration-200"
                        >
                          Voltar ao Menu
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {resultado && (
                <ContextChat
                  context={resultado}
                  contextLabel="simulado ENAMED IA"
                  suggestions={enamedChatSuggestions}
                />
              )}
            </div>
          </>
        )}

      </div>
    </DashboardLayout>
  );
};

export default Enamed;
