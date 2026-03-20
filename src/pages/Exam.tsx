import { useState, useRef, useEffect } from 'react';
import PageSkeleton from '@/components/PageSkeleton';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useAdmin } from '@/hooks/useAdmin';
import { useToast } from '@/hooks/use-toast';
import { useExamGenerator, type ExamConfig, type PracticeMode } from '@/hooks/useExamGenerator';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import GenerationProgress from '@/components/GenerationProgress';
import ExamConfigPanel from '@/components/exam/ExamConfigPanel';
import SimulationView from '@/components/exam/SimulationView';
import ContextChat from '@/components/ContextChat';
import { exportToPDF } from '@/utils/pdfExport';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import OnboardingTour, { type TourStep } from '@/components/OnboardingTour';
import DashboardLayout from '@/components/layout/DashboardLayout';

const MI = ({ name, fill = false, className = '' }: { name: string; fill?: boolean; className?: string }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontVariationSettings: fill ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : undefined }}
  >
    {name}
  </span>
);

const examTourSteps: TourStep[] = [
  {
    target: '[data-tour="content-selector"]',
    title: 'Selecione o Conteúdo',
    description: 'Escolha um ou mais fechamentos da sua biblioteca. As questões serão baseadas nesse material.',
    placement: 'right',
  },
  {
    target: '[data-tour="exam-config"]',
    title: 'Configure a Prova',
    description: 'Defina a quantidade de questões e o nível de dificuldade.',
    placement: 'right',
  },
  {
    target: '[data-tour="generate-exam-btn"]',
    title: 'Gerar Prova',
    description: 'Clique para a IA elaborar as questões no modo simulação.',
    placement: 'right',
  },
];

function hasParseableQuestion(text: string): boolean {
  const blocks = text.split(/(?=##\s*Questão\s+\d+)/i);
  for (const block of blocks) {
    if (!block.match(/##\s*Questão\s+\d+/i)) continue;
    const altRegex = /\*\*([A-E])\)\*\*\s*(.+)/g;
    const alts: string[] = [];
    let m;
    while ((m = altRegex.exec(block)) !== null) {
      if (!alts.includes(m[1])) alts.push(m[1]);
    }
    if (alts.length >= 4) return true;
  }
  return false;
}

const Exam = () => {
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading: subLoading } = useSubscription();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const modeFromUrl = searchParams.get('mode') as PracticeMode | null;
  const lockedMode = modeFromUrl === 'caso_clinico' || modeFromUrl === 'prova' ? modeFromUrl : null;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [config, setConfig] = useState<ExamConfig>({
    quantidade: 20,
    nivel: 'residencia',
    simulationMode: true,
    practiceMode: lockedMode || 'prova',
  });
  const [exporting, setExporting] = useState(false);
  const [showSimulation, setShowSimulation] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lockedMode && config.practiceMode !== lockedMode) {
      setConfig(prev => ({ ...prev, practiceMode: lockedMode }));
    }
  }, [lockedMode]);

  useEffect(() => {
    if (!config.simulationMode) {
      setConfig(prev => ({ ...prev, simulationMode: true }));
    }
  }, [config.simulationMode]);

  const {
    resultado,
    generating,
    hasStartedReceiving,
    isComplete,
    currentConfig,
    generate,
    saveToLibrary,
    reset,
  } = useExamGenerator();

  useEffect(() => {
    if (showSimulation) return;
    if (!hasStartedReceiving || !resultado) return;

    if (config.practiceMode === 'prova' && hasParseableQuestion(resultado)) {
      setShowSimulation(true);
    } else if (config.practiceMode === 'caso_clinico' && resultado.length > 100) {
      setShowSimulation(true);
    }
  }, [hasStartedReceiving, resultado, config.practiceMode, showSimulation]);

  if (authLoading || subLoading || adminLoading) {
    return <PageSkeleton variant="exam" />;
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!hasAccess && !isAdmin) return <Navigate to="/pricing" replace />;

  const handleGenerate = async () => {
    const { data, error } = await supabase
      .from('fechamentos')
      .select('tema, resultado')
      .in('id', selectedIds);

    if (error || !data || data.length === 0) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o conteúdo selecionado.',
        variant: 'destructive',
      });
      return;
    }

    const conteudo = data
      .map(f => `## ${f.tema}\n\n${f.resultado}`)
      .join('\n\n---\n\n');

    setShowSimulation(false);
    setExamStarted(true);

    await generate(conteudo, config);
  };

  const handleBackToMenu = () => {
    setExamStarted(false);
    setShowSimulation(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(resultado);
    toast({ title: 'Copiado!', description: 'Conteúdo copiado para a área de transferência.' });
  };

  const handleExportPDF = async () => {
    if (!resultRef.current || !resultado) return;
    setExporting(true);
    try {
      const title = config.practiceMode === 'caso_clinico'
        ? `Caso Clínico - ${config.nivel === 'basico' ? 'Residente' : 'Especialista'}`
        : `Prova - ${config.nivel === 'basico' ? 'Residente' : 'Especialista'} (${config.quantidade}Q)`;
      await exportToPDF({ tema: title, contentElement: resultRef.current });
      toast({ title: 'PDF exportado!', description: 'Conteúdo salvo como PDF.' });
    } catch (error) {
      toast({ title: 'Erro ao exportar', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const isProva = config.practiceMode === 'prova';
  const modeLabel = lockedMode === 'caso_clinico' ? 'Casos Clínicos' : 'Simulados';

  return (
    <DashboardLayout mainClassName="pb-4 px-4 sm:px-6">
      <OnboardingTour steps={examTourSteps} tourKey="exam" />

      <div className="max-w-5xl mx-auto">
        {examStarted ? (
          <div className="flex flex-col gap-4">
            {/* Back button */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToMenu}
                className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#006D5B] transition-colors active:scale-95"
              >
                <ArrowLeft className="h-4 w-4" /> Nova Configuração
              </button>
              <span className="text-xs text-slate-400">{isProva ? 'Simulado' : 'Caso Clínico'}</span>
            </div>

            {/* Exam content area */}
            <div className="flex flex-col lg:flex-row gap-4 min-h-[50vh] lg:min-h-[calc(100vh-10rem)]">
              <div className="flex-1 min-w-0 rounded-xl bg-white border border-slate-100 shadow-[0_4px_20px_rgba(25,28,29,0.06)] p-4 sm:p-6 flex flex-col overflow-hidden">
                {showSimulation && isProva ? (
                  <SimulationView
                    resultado={resultado}
                    onExit={handleBackToMenu}
                    isGenerating={generating}
                    isComplete={isComplete}
                  />
                ) : showSimulation && !isProva ? (
                  <div className="flex-1 overflow-y-auto">
                    <div ref={resultRef} className="prose prose-sm max-w-none prose-headings:text-[#191c1d]">
                      <MarkdownRenderer content={resultado} isTyping={generating} />
                    </div>
                    {generating && (
                      <div className="flex items-center gap-2 mt-4 text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Elaborando caso clínico...</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-16 text-center space-y-6 max-w-md mx-auto">
                    <GenerationProgress
                      isGenerating={generating}
                      hasStartedReceiving={hasStartedReceiving}
                      isComplete={isComplete}
                    />
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700">
                        {isProva ? 'Elaborando questões...' : 'Elaborando caso clínico...'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {hasStartedReceiving
                          ? 'Recebendo conteúdo — as questões aparecerão automaticamente.'
                          : 'Conectando com a IA, aguarde um momento.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {resultado && (
                <ContextChat
                  context={resultado}
                  contextLabel="simulado"
                  suggestions={[
                    'Por que a alternativa correta está certa?',
                    'Quais são os diagnósticos diferenciais?',
                    'Explique a fisiopatologia envolvida',
                    'Que pegadinhas comuns caem sobre esse tema?',
                  ]}
                />
              )}
            </div>
          </div>
        ) : (
          /* ── Config Page ── */
          <div className="px-2 sm:px-4 py-6 sm:py-12 relative">
            {/* Background orbs */}
            <div className="absolute -top-16 -right-16 w-64 h-64 bg-[#9df3dc]/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-60 -left-20 w-48 h-48 bg-[#006D5B]/6 rounded-full blur-3xl pointer-events-none animate-float" />

            {/* Header */}
            <div className="mb-8 sm:mb-12 relative z-10 animate-fade-up">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#c8eade] text-[#4c6a62] text-xs font-bold mb-4">
                <MI name="shutter_speed" className="text-[14px]" />
                SIMULAÇÕES
              </span>
              <h2 className="font-['Manrope'] text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#191c1d] tracking-tight mb-3">
                {modeLabel} com IA
              </h2>
              <p className="text-sm sm:text-base text-[#3e4945] max-w-2xl leading-relaxed">
                Configure e gere questões personalizadas baseadas nos seus resumos da biblioteca.
                Nossa IA analisa seu progresso para criar o desafio ideal.
              </p>
            </div>

            <ExamConfigPanel
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              config={config}
              onConfigChange={(c) => setConfig({ ...c, simulationMode: true })}
              generating={generating}
              hasStartedReceiving={hasStartedReceiving}
              isComplete={isComplete}
              onGenerate={handleGenerate}
              lockedMode={lockedMode}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Exam;
