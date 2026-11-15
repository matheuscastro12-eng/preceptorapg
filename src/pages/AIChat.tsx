import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Trash2, User, Copy, FileDown, Check } from 'lucide-react';
import logoIcon from '@/assets/logo-icon.png';
import { useToast } from '@/hooks/use-toast';
import { exportToPDF } from '@/utils/pdfExport';
import { motion, AnimatePresence } from 'framer-motion';
import PageSkeleton from '@/components/PageSkeleton';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import UpgradePaywall from '@/components/UpgradePaywall';
import { useDemoLimit } from '@/hooks/useDemoLimit';
import DashboardLayout from '@/components/layout/DashboardLayout';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Explique a fisiopatologia da insuficiência cardíaca congestiva',
  'Quais são os mecanismos de ação dos beta-bloqueadores?',
  'Descreva a cascata de coagulação e suas implicações clínicas',
  'Como funciona o eixo hipotálamo-hipófise-adrenal?',
  'Diagnóstico diferencial de dor torácica aguda',
  'Explique a regulação do equilíbrio ácido-base renal',
];

const AIChat = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSubscriber, remainingPrompts, hasReachedLimit, dailyLimit, usedToday, incrementUsage, loading: demoLoading } = useDemoLimit();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stripMarkdown = (md: string) =>
    md.replace(/#{1,6}\s?/g, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/`(.+?)`/g, '$1').replace(/---/g, '').replace(/- /g, '• ').trim();

  const handleCopy = async (msg: ChatMessage) => {
    await navigator.clipboard.writeText(stripMarkdown(msg.content));
    setCopiedId(msg.id);
    toast({ title: 'Copiado!', description: 'Resposta copiada para a área de transferência.' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePDF = (msg: ChatMessage) => {
    const container = document.createElement('div');
    container.className = 'markdown-content';
    const el = document.getElementById(`msg-${msg.id}`);
    if (el) {
      container.innerHTML = el.innerHTML;
    } else {
      container.innerText = msg.content;
    }
    const idx = messages.findIndex(m => m.id === msg.id);
    const question = idx > 0 ? messages[idx - 1]?.content : 'PreceptorMED';
    exportToPDF({ tema: question.slice(0, 100), contentElement: container });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const streamChat = async (userMessage: string) => {
    if (!isSubscriber && hasReachedLimit) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: userMessage };
    const assistantId = crypto.randomUUID();

    setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }]);
    setIsStreaming(true);
    setInput('');

    if (!isSubscriber) {
      incrementUsage();
    }

    const allMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ messages: allMessages }),
          signal: controller.signal,
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m)
              );
            }
          } catch { /* partial json */ }
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      const message = e instanceof Error ? e.message : 'Erro ao processar sua pergunta. Tente novamente.';
      setMessages(prev => [
        ...prev.filter(m => m.id !== assistantId),
        { id: assistantId, role: 'assistant', content: `⚠️ ${message}` },
      ]);
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    if (!isSubscriber && hasReachedLimit) return;
    streamChat(input.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      handleSend();
    }
  };

  const clearChat = () => {
    if (isStreaming) {
      abortRef.current?.abort();
    }
    setMessages([]);
    setIsStreaming(false);
  };

  if (authLoading || demoLoading) return <PageSkeleton variant="menu" />;
  if (!user) return <Navigate to="/auth" replace />;

  const isEmpty = messages.length === 0;

  return (
    <DashboardLayout mainClassName="h-[calc(100vh-4rem)] flex flex-col overflow-hidden" hideFooter>
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2">
          <img src={logoIcon} alt="PreceptorMED" className="h-7 w-7" />
          <div>
            <span className="font-bold text-emerald-900 text-sm" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              PreceptorMED <span style={{ color: '#126b62' }}>Chat</span>
            </span>
            <span className="text-[10px] text-slate-400 block leading-none">Assistente Acadêmico</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearChat}
          className="text-slate-400 hover:text-red-500 gap-1.5 text-xs"
          disabled={isEmpty && !isStreaming}
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Limpar conversa</span>
        </Button>
      </div>

      {/* Demo banner */}
      {!isSubscriber && !hasReachedLimit && (
        <UpgradePaywall variant="banner" remainingPrompts={remainingPrompts} dailyLimit={dailyLimit} />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {hasReachedLimit && !isSubscriber ? (
          <div className="h-full flex items-center justify-center px-4">
            <UpgradePaywall variant="chat-limit" remainingPrompts={remainingPrompts} dailyLimit={dailyLimit} />
          </div>
        ) : isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center px-4 py-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="text-center max-w-lg"
            >
              <img src={logoIcon} alt="PreceptorMED" className="h-14 w-14 mx-auto mb-5" />
              <h2 className="text-xl sm:text-2xl font-bold text-emerald-900 mb-2" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                Olá! Sou o <span style={{ color: '#126b62' }}>PreceptorMED</span>
              </h2>
              <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                Seu assistente acadêmico de medicina. Pergunte qualquer coisa — de bioquímica molecular a raciocínio clínico.
              </p>

              {!isSubscriber && (
                <div className="mb-6 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <p className="text-xs text-slate-500">
                    🎁 <span className="font-medium text-slate-700">Modo Demonstração</span> — Você tem{' '}
                    <span className="font-bold" style={{ color: '#126b62' }}>{remainingPrompts}</span> perguntas grátis hoje.{' '}
                    <button onClick={() => navigate('/pricing')} className="font-semibold hover:underline" style={{ color: '#126b62' }}>Assine para ilimitado →</button>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTIONS.map((s, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    onClick={() => streamChat(s)}
                    className="text-left p-3 rounded-xl border border-slate-100 bg-white hover:bg-emerald-50 hover:border-emerald-200 transition-all text-xs text-slate-500 hover:text-slate-700 leading-relaxed shadow-sm"
                  >
                    {s}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
            <AnimatePresence initial={false}>
              {messages.map(m => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.role === 'assistant' && (
                    <div className="shrink-0 h-8 w-8 rounded-lg overflow-hidden mt-1">
                      <img src={logoIcon} alt="PreceptorMED" className="h-8 w-8" />
                    </div>
                  )}
                  <div className={`max-w-[85%] sm:max-w-[75%] group/msg ${
                    m.role === 'user'
                      ? 'px-4 py-3 rounded-2xl rounded-br-md text-white text-sm'
                      : 'bg-white border border-slate-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm'
                  }`} style={m.role === 'user' ? { background: 'linear-gradient(135deg, #126b62, #005e56)' } : {}}>
                    {m.role === 'assistant' ? (
                      <>
                        {!m.content && isStreaming && m.id === messages[messages.length - 1]?.id && (
                          <div className="flex items-center gap-2 py-2 px-1">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-[wave_1.2s_ease-in-out_infinite]" />
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-[wave_1.2s_ease-in-out_0.2s_infinite]" />
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-[wave_1.2s_ease-in-out_0.4s_infinite]" />
                            <span className="text-xs text-slate-400 ml-1">Elaborando resposta</span>
                          </div>
                        )}
                        {m.content && (
                          <div id={`msg-${m.id}`} className="prose prose-sm max-w-none text-sm prose-headings:text-emerald-900 prose-a:text-emerald-700">
                            <MarkdownRenderer content={m.content} isTyping={isStreaming && m.id === messages[messages.length - 1]?.id} />
                          </div>
                        )}
                        {m.content && !(isStreaming && m.id === messages[messages.length - 1]?.id) && (
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-400 hover:text-slate-700 gap-1" onClick={() => handleCopy(m)}>
                              {copiedId === m.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              {copiedId === m.id ? 'Copiado' : 'Copiar'}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-400 hover:text-slate-700 gap-1" onClick={() => handlePDF(m)}>
                              <FileDown className="h-3 w-3" /> PDF
                            </Button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                    )}
                  </div>
                  {m.role === 'user' && (
                    <div className="shrink-0 h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center mt-1">
                      <User className="h-4 w-4 text-emerald-600" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-slate-100 bg-white p-3 sm:p-4">
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            placeholder={hasReachedLimit && !isSubscriber ? 'Limite diário atingido — assine para continuar' : 'Pergunte sobre qualquer tema médico...'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-h-[44px] max-h-[120px] resize-none text-sm border-slate-200"
            rows={1}
            disabled={isStreaming || (hasReachedLimit && !isSubscriber)}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming || (hasReachedLimit && !isSubscriber)}
            size="icon"
            className="shrink-0 h-11 w-11 rounded-xl"
            style={{ background: 'linear-gradient(135deg, #126b62, #005e56)' }}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-center text-[10px] text-slate-300 mt-2">
          PreceptorMED é uma ferramenta educacional. Sempre valide com fontes primárias.
        </p>
      </div>
    </DashboardLayout>
  );
};

export default AIChat;
