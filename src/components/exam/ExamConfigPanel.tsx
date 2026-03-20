import { Slider } from '@/components/ui/slider';
import GenerationProgress from '@/components/GenerationProgress';
import ContentSelector from './ContentSelector';
import type { ExamConfig, PracticeMode } from '@/hooks/useExamGenerator';
import { Loader2 } from 'lucide-react';

interface ExamConfigPanelProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  config: ExamConfig;
  onConfigChange: (config: ExamConfig) => void;
  generating: boolean;
  hasStartedReceiving: boolean;
  isComplete: boolean;
  onGenerate: () => void;
  lockedMode?: PracticeMode | null;
}

const MI = ({ name, fill = false, className = '' }: { name: string; fill?: boolean; className?: string }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontVariationSettings: fill ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : undefined }}
  >
    {name}
  </span>
);

const ExamConfigPanel = ({
  selectedIds,
  onSelectionChange,
  config,
  onConfigChange,
  generating,
  hasStartedReceiving,
  isComplete,
  onGenerate,
  lockedMode,
}: ExamConfigPanelProps) => {
  const isProva = config.practiceMode === 'prova';
  const isCasoClin = config.practiceMode === 'caso_clinico';

  const selectedTemas = selectedIds.length > 0
    ? `seus ${selectedIds.length} resumo${selectedIds.length > 1 ? 's' : ''} selecionado${selectedIds.length > 1 ? 's' : ''}`
    : 'seus resumos';

  return (
    <div className="space-y-10 sm:space-y-16">
      {/* ── Step 1: Tipo de Prática ── */}
      {!lockedMode && (
        <section className="animate-fade-up">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-[#006d5b] text-white text-sm font-bold shadow-lg shadow-[#006d5b]/20">1</span>
            <h3 className="font-['Manrope'] text-lg sm:text-xl font-bold text-[#191c1d]">Tipo de Prática</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card Prova */}
            <button
              onClick={() => onConfigChange({ ...config, practiceMode: 'prova' })}
              disabled={generating}
              className="relative group text-left disabled:opacity-50"
            >
              <div className={`relative p-4 sm:p-7 rounded-2xl border-2 bg-white transition-all duration-300 group-active:scale-[0.98] group-hover:-translate-y-0.5 ${
                isProva ? 'border-[#005344] shadow-lg shadow-[#005344]/8' : 'border-slate-200/60 hover:border-[#bec9c4]/60 hover:shadow-md'
              }`}>
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 ${isProva ? 'bg-[#9df3dc] text-[#005344] scale-105' : 'bg-[#f3f4f5] text-[#6e7975] group-hover:bg-[#e1e3e4]'}`}>
                    <MI name="fact_check" className="text-[28px]" />
                  </div>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isProva ? 'bg-[#005344] text-white scale-100' : 'bg-slate-100 text-slate-300 scale-90'
                  }`}>
                    <MI name="check" className="text-[16px]" />
                  </div>
                </div>
                <h4 className="font-['Manrope'] text-lg font-bold text-[#191c1d] mb-2">Prova</h4>
                <p className="text-sm text-[#3e4945] leading-relaxed">Foco em questões teóricas, múltipla escolha e fixação de conceitos acadêmicos.</p>
              </div>
            </button>

            {/* Card Caso Clínico */}
            <button
              onClick={() => onConfigChange({ ...config, practiceMode: 'caso_clinico' })}
              disabled={generating}
              className="relative group text-left disabled:opacity-50"
            >
              <div className={`relative p-4 sm:p-7 rounded-2xl border-2 bg-white transition-all duration-300 group-active:scale-[0.98] group-hover:-translate-y-0.5 ${
                isCasoClin ? 'border-[#005344] shadow-lg shadow-[#005344]/8' : 'border-slate-200/60 hover:border-[#bec9c4]/60 hover:shadow-md'
              }`}>
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 ${isCasoClin ? 'bg-[#9df3dc] text-[#005344] scale-105' : 'bg-[#f3f4f5] text-[#6e7975] group-hover:bg-[#e1e3e4]'}`}>
                    <MI name="clinical_notes" className="text-[28px]" />
                  </div>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCasoClin ? 'bg-[#005344] text-white scale-100' : 'bg-slate-100 text-slate-300 scale-90'
                  }`}>
                    <MI name="check" className="text-[16px]" />
                  </div>
                </div>
                <h4 className="font-['Manrope'] text-lg font-bold text-[#191c1d] mb-2">Caso Clínico</h4>
                <p className="text-sm text-[#3e4945] leading-relaxed">Simulação de atendimento real com diagnóstico, conduta e raciocínio clínico aplicado.</p>
              </div>
            </button>
          </div>
        </section>
      )}

      {/* ── Step 2: Selecione o conteúdo ── */}
      <section data-tour="content-selector" className="animate-fade-up" style={{ animationDelay: '0.08s' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-[#006d5b] text-white text-sm font-bold shadow-lg shadow-[#006d5b]/20">
              {lockedMode ? '1' : '2'}
            </span>
            <h3 className="font-['Manrope'] text-lg sm:text-xl font-bold text-[#191c1d]">Selecione o conteúdo</h3>
          </div>
          {selectedIds.length > 0 && (
            <span className="px-3.5 py-1.5 rounded-full bg-[#c8eade] text-[#4c6a62] text-xs font-bold animate-scale-up">
              {selectedIds.length} selecionado{selectedIds.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <ContentSelector
          selectedIds={selectedIds}
          onSelectionChange={onSelectionChange}
          disabled={generating}
        />
      </section>

      {/* ── Step 3 & 4: Quantidade + Nível ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 animate-fade-up" style={{ animationDelay: '0.16s' }} data-tour="exam-config">
        {/* Step 3: Quantidade de Questões (prova only) */}
        {isProva && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <span className="flex items-center justify-center w-9 h-9 rounded-full bg-[#006d5b] text-white text-sm font-bold shadow-lg shadow-[#006d5b]/20">
                {lockedMode ? '2' : '3'}
              </span>
              <h3 className="font-['Manrope'] text-lg sm:text-xl font-bold text-[#191c1d]">Quantidade de Questões</h3>
            </div>
            <div className="bg-white p-5 sm:p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-center">
              <div className="flex justify-between items-end mb-4">
                <span className="text-xs font-bold text-[#6e7975]">MIN: 5</span>
                <span className="text-3xl sm:text-5xl font-['Manrope'] font-black text-[#005344] tabular-nums transition-all duration-200">{config.quantidade}</span>
                <span className="text-xs font-bold text-[#6e7975]">MAX: 60</span>
              </div>
              <Slider
                value={[config.quantidade]}
                onValueChange={([v]) => onConfigChange({ ...config, quantidade: v })}
                min={5}
                max={60}
                step={5}
                disabled={generating}
                className="py-1"
              />
            </div>
          </section>
        )}

        {/* Step 4: Nível de Dificuldade */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-[#006d5b] text-white text-sm font-bold shadow-lg shadow-[#006d5b]/20">
              {lockedMode ? (isProva ? '3' : '2') : (isProva ? '4' : '3')}
            </span>
            <h3 className="font-['Manrope'] text-lg sm:text-xl font-bold text-[#191c1d]">Nível de Dificuldade</h3>
          </div>
          <div className="bg-white p-5 sm:p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-center">
            <div className="flex bg-[#f3f4f5] p-1.5 rounded-xl w-full">
              {[
                { value: 'basico' as const, label: 'Residente', icon: 'school' },
                { value: 'residencia' as const, label: 'Especialista', icon: 'workspace_premium' },
              ].map(({ value, label, icon }) => (
                <button
                  key={value}
                  onClick={() => onConfigChange({ ...config, nivel: value })}
                  disabled={generating}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold rounded-lg transition-all duration-300 disabled:opacity-50 ${
                    config.nivel === value
                      ? 'bg-[#005344] text-white shadow-lg shadow-[#005344]/20 scale-[1.02]'
                      : 'text-[#3e4945] hover:bg-white/60'
                  }`}
                >
                  <MI name={icon} className="text-[18px]" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ── AI Insight Card ── */}
      {selectedIds.length > 0 && (
        <div className="p-4 sm:p-8 rounded-2xl bg-gradient-to-br from-[#006d5b]/5 to-[#005344]/8 border border-[#005344]/10 relative overflow-hidden group hover:shadow-lg transition-all duration-500 animate-fade-up">
          <div className="absolute top-0 right-0 w-40 h-40 bg-[#005344]/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-[#005344]/8 transition-all duration-700" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#9df3dc]/8 rounded-full -ml-8 -mb-8 blur-2xl group-hover:bg-[#9df3dc]/12 transition-all duration-700" />
          <div className="relative flex items-start sm:items-center gap-3 sm:gap-6">
            <div className="shrink-0 w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300">
              <MI name="auto_awesome" fill className="text-[#005344] text-[20px] sm:text-[24px]" />
            </div>
            <div>
              <h4 className="font-['Manrope'] font-bold text-[#005344] mb-1">Curadoria Inteligente Ativa</h4>
              <p className="text-sm text-[#3e4945]/80 leading-relaxed">
                Com base em {selectedTemas}, a IA priorizará questões sobre os pontos-chave e diretrizes mais recentes, focando nas áreas de maior relevância para provas.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Generate Button ── */}
      <div className="flex flex-col items-center pt-6 sm:pt-8 border-t border-slate-200/40 animate-fade-up" style={{ animationDelay: '0.24s' }} data-tour="generate-exam-btn">
        <button
          onClick={onGenerate}
          disabled={generating || selectedIds.length === 0}
          className="btn-shimmer relative overflow-hidden w-full sm:w-auto px-8 sm:px-14 py-4 sm:py-5 rounded-xl font-['Manrope'] text-base sm:text-lg font-extrabold uppercase tracking-widest text-white flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl hover:scale-[1.03] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0 group"
          style={{ background: 'linear-gradient(135deg, #005344 0%, #006d5b 100%)' }}
        >
          {generating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {isProva ? 'Gerando prova...' : 'Gerando caso...'}
            </>
          ) : (
            <>
              Gerar Simulado
              <MI name="colors_spark" fill className="text-[20px] group-hover:scale-110 transition-transform duration-200" />
            </>
          )}
        </button>

        {selectedIds.length === 0 && !generating && (
          <p className="mt-4 text-xs text-[#6e7975] font-medium flex items-center gap-1.5">
            <MI name="info" className="text-[14px]" />
            Selecione pelo menos um conteúdo da biblioteca acima
          </p>
        )}

        {generating && (
          <div className="mt-4 w-full max-w-md">
            <GenerationProgress
              isGenerating={generating}
              hasStartedReceiving={hasStartedReceiving}
              isComplete={isComplete}
            />
          </div>
        )}

        {!generating && selectedIds.length > 0 && (
          <p className="mt-4 text-xs text-[#6e7975] font-medium flex items-center gap-1.5">
            <MI name="timer" className="text-[14px]" />
            Tempo estimado: {isProva ? `${Math.max(10, Math.round(config.quantidade * 0.6))} segundos` : '15 segundos'}
          </p>
        )}
      </div>
    </div>
  );
};

export default ExamConfigPanel;
