import GenerationProgress from '@/components/GenerationProgress';
import type { GenerationMode } from './ModeToggle';
import { Loader2 } from 'lucide-react';

interface InputPanelProps {
  tema: string;
  setTema: (value: string) => void;
  objetivos: string;
  setObjetivos: (value: string) => void;
  modo: GenerationMode;
  setModo: (value: GenerationMode) => void;
  generating: boolean;
  hasStartedReceiving: boolean;
  isComplete: boolean;
  onGenerate: () => void;
  canGenerate?: boolean;
  cooldown?: boolean;
}

const MI = ({ name, fill = false, className = '' }: { name: string; fill?: boolean; className?: string }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontVariationSettings: fill ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : undefined }}
  >
    {name}
  </span>
);

const MAX_TEMA_LENGTH = 500;
const MAX_OBJETIVOS_LENGTH = 2000;

const suggestions = ['Insuficiência Cardíaca', 'Diabetes Mellitus Tipo 2', 'Hipertensão Arterial', 'TDAH'];

const InputPanel = ({
  tema, setTema, objetivos, setObjetivos,
  modo, setModo, generating, hasStartedReceiving,
  isComplete, onGenerate, canGenerate = true, cooldown = false,
}: InputPanelProps) => {
  const isSeminario = modo === 'seminario';

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 md:p-8 shadow-[0_12px_40px_rgba(25,28,29,0.06)] border border-slate-100/60 hover:shadow-[0_16px_48px_rgba(25,28,29,0.08)] transition-shadow duration-500">
      {/* Mode Toggle */}
      <div className="flex p-1 bg-[#f3f4f5] rounded-xl w-full sm:w-fit mb-6 sm:mb-10" data-tour="mode-toggle">
        {[
          { mode: 'fechamento' as GenerationMode, label: 'Resumo', icon: 'description' },
          { mode: 'seminario' as GenerationMode, label: 'Seminário', icon: 'slideshow' },
        ].map(({ mode, label, icon }) => (
          <button
            key={mode}
            onClick={() => setModo(mode)}
            disabled={generating}
            className={`flex items-center justify-center gap-2 flex-1 sm:flex-initial px-4 sm:px-8 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 disabled:opacity-50 ${
              modo === mode
                ? 'bg-white text-[#005344] shadow-sm scale-[1.02]'
                : 'text-[#3e4945] hover:text-[#191c1d]'
            }`}
          >
            <MI name={icon} className="text-[18px]" />
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-6 sm:space-y-8">
        {/* Tema Central */}
        <div data-tour="tema-input">
          <label className="flex items-center gap-2 text-sm font-bold text-[#191c1d] mb-3 tracking-tight">
            <MI name="subject" className="text-[18px] text-[#006D5B]" />
            Tema Central
          </label>
          <div className="relative group">
            <input
              type="text"
              placeholder="Ex: Insuficiência Cardíaca Congestiva"
              value={tema}
              onChange={(e) => setTema(e.target.value.slice(0, MAX_TEMA_LENGTH))}
              disabled={generating}
              className="w-full px-4 sm:px-6 py-3.5 sm:py-4 bg-[#f3f4f5] border-2 border-transparent rounded-xl text-[#191c1d] placeholder:text-[#6e7975]/60 focus:outline-none focus:border-[#006D5B]/30 focus:bg-white focus:shadow-[0_0_0_4px_rgba(0,109,91,0.06)] transition-all duration-300 text-base sm:text-lg font-medium disabled:opacity-50"
            />
            <MI name="edit_note" className="absolute right-4 top-1/2 -translate-y-1/2 text-[#005344]/30 text-[22px] group-hover:text-[#005344]/50 transition-colors duration-200" />
          </div>

          {/* Quick chips */}
          {!tema && (
            <div className="mt-4 flex flex-wrap gap-2">
              {suggestions.map((s, i) => (
                <button
                  key={s}
                  onClick={() => setTema(s)}
                  disabled={generating}
                  type="button"
                  style={{ animationDelay: `${i * 0.05}s` }}
                  className="animate-fade-up px-4 py-1.5 rounded-full bg-[#edeeef] border border-[#bec9c4]/20 text-xs font-semibold text-[#3e4945] hover:bg-[#006d5b]/10 hover:text-[#005344] hover:border-[#006d5b]/20 hover:scale-105 transition-all duration-200 active:scale-95 disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {tema.length > MAX_TEMA_LENGTH * 0.8 && (
            <p className="text-[10px] text-[#6e7975] text-right mt-1">{tema.length}/{MAX_TEMA_LENGTH}</p>
          )}
        </div>

        {/* Objetivos */}
        <div data-tour="objetivos-input">
          <label className="flex items-center gap-2 text-sm font-bold text-[#191c1d] mb-3 tracking-tight">
            <MI name="target" className="text-[18px] text-[#006D5B]" />
            Objetivos <span className="text-[#6e7975] font-normal">(opcional)</span>
          </label>
          <textarea
            placeholder={isSeminario
              ? "Adicione focos específicos, como 'Critérios de Framingham' ou 'Manejo na Emergência'..."
              : "Adicione focos específicos, como 'Critérios de Framingham' ou 'Manejo na Emergência'..."}
            value={objetivos}
            onChange={(e) => setObjetivos(e.target.value.slice(0, MAX_OBJETIVOS_LENGTH))}
            disabled={generating}
            rows={4}
            className="w-full px-4 sm:px-6 py-3.5 sm:py-4 bg-[#f3f4f5] border-2 border-transparent rounded-xl text-[#191c1d] placeholder:text-[#6e7975]/60 focus:outline-none focus:border-[#006D5B]/30 focus:bg-white focus:shadow-[0_0_0_4px_rgba(0,109,91,0.06)] transition-all duration-300 text-sm sm:text-base font-medium resize-none disabled:opacity-50"
          />
        </div>

        {/* Generate Button */}
        <div className="pt-4" data-tour="generate-btn">
          <button
            onClick={onGenerate}
            disabled={!canGenerate}
            className="btn-shimmer relative overflow-hidden w-full py-4 sm:py-5 rounded-xl font-['Manrope'] font-bold text-base sm:text-lg text-white flex items-center justify-center gap-2 sm:gap-3 shadow-lg active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 hover:shadow-xl hover:-translate-y-0.5 group"
            style={{ background: canGenerate ? 'linear-gradient(135deg, #005344 0%, #006d5b 100%)' : 'linear-gradient(135deg, #6b8f8c, #4a6e6b)' }}
          >
            {generating ? (
              <><Loader2 className="h-5 w-5 animate-spin" />{isSeminario ? 'Gerando roteiro...' : 'Gerando conteúdo...'}</>
            ) : cooldown ? (
              <><MI name="timer" className="text-[20px]" />Aguarde antes de gerar novamente...</>
            ) : (
              <>
                <MI name="bolt" fill className="text-[22px] group-hover:scale-110 transition-transform duration-200" />
                {isSeminario ? 'Gerar Roteiro de Slides' : 'Gerar Resumo'}
                <MI name="arrow_forward" className="text-[18px] opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" />
              </>
            )}
          </button>

          {generating ? (
            <div className="mt-3">
              <p className="text-[10px] text-[#6e7975] text-center mb-2">
                Não feche ou atualize a página durante a geração.
              </p>
              <GenerationProgress
                isGenerating={generating}
                hasStartedReceiving={hasStartedReceiving}
                isComplete={isComplete}
              />
            </div>
          ) : (
            <p className="text-center text-[10px] text-[#6e7975] mt-4 font-medium uppercase tracking-widest">
              Tempo estimado de geração: 30 segundos
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default InputPanel;
