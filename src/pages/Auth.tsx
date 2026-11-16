import { useState, useEffect } from 'react';
import { Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, BookOpen, Brain, FileText, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { motion, AnimatePresence } from 'framer-motion';
import logoPreceptor from '@/assets/logo-preceptor.png';

const Auth = () => {
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [redirectingToCheckout, setRedirectingToCheckout] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(
    searchParams.get('tab') === 'signup' ? 'signup' : 'login'
  );

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');

  const planType = searchParams.get('plan') as 'monthly' | 'annual' | null;

  useEffect(() => {
    const redirectToCheckout = async () => {
      if (user && planType && !redirectingToCheckout) {
        setRedirectingToCheckout(true);
        try {
          const { data, error } = await supabase.functions.invoke('create-checkout', {
            body: { planType }
          });
          if (error) throw error;
          if (data?.url) window.location.href = data.url;
        } catch (error) {
          console.error('Checkout error:', error);
          toast({ title: 'Erro', description: 'Não foi possível iniciar o checkout.', variant: 'destructive' });
          setRedirectingToCheckout(false);
        }
      }
    };
    redirectToCheckout();
  }, [user, planType, redirectingToCheckout, toast]);

  if (authLoading || redirectingToCheckout) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          {redirectingToCheckout && (
            <p className="text-sm text-muted-foreground">Redirecionando para o checkout...</p>
          )}
        </div>
      </div>
    );
  }

  if (user && !planType) return <Navigate to="/menu" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    if (error) toast({ title: 'Erro ao entrar', description: error.message, variant: 'destructive' });
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupPassword !== signupConfirmPassword) {
      toast({ title: 'Erro', description: 'As senhas não coincidem', variant: 'destructive' });
      return;
    }
    if (signupPassword.length < 6) {
      toast({ title: 'Erro', description: 'A senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName);
    if (error) {
      toast({ title: 'Erro ao criar conta', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Conta criada!', description: 'Verifique seu email para confirmar o cadastro.' });
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Email enviado!', description: 'Verifique sua caixa de entrada para redefinir a senha.' });
      setShowForgotPassword(false);
    }
    setForgotLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast({ title: 'Erro ao entrar com Google', description: error.message, variant: 'destructive' });
      setLoading(false);
    }
  };

  const features = [
    { icon: Brain, text: 'Resumos com IA', desc: 'Conteúdo médico estruturado em segundos' },
    { icon: FileText, text: 'Simulados', desc: 'Provas no estilo residência médica' },
    { icon: BookOpen, text: 'Biblioteca', desc: 'Todo seu conteúdo organizado e salvo' },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Left Panel */}
      <div
        className="hidden lg:flex lg:w-[52%] relative flex-col items-center justify-center p-16 overflow-hidden"
        style={{ background: 'linear-gradient(160deg, hsl(168,76%,20%) 0%, hsl(168,76%,32%) 60%, hsl(185,70%,28%) 100%)' }}
      >
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative z-10 max-w-md w-full">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-12">
              <img src={logoPreceptor} alt="PreceptorMED" className="h-9 w-9 rounded-lg" />
              <span className="text-xl font-bold text-white tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                PreceptorMED
              </span>
            </div>

            <h2 className="text-[2.4rem] font-bold text-white leading-[1.15] tracking-tight mb-5">
              Estude medicina<br />de forma inteligente.
            </h2>
            <p className="text-base text-white/65 leading-relaxed mb-12">
              Resumos, simulados e casos clínicos gerados por IA — tudo integrado para sua aprovação na residência.
            </p>
          </motion.div>

          <div className="space-y-3">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
                className="flex items-center gap-4 bg-white/8 border border-white/10 rounded-lg px-5 py-4"
              >
                <div className="h-8 w-8 rounded-lg bg-white/12 flex items-center justify-center shrink-0">
                  <feature.icon className="h-4 w-4 text-white" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-white">{feature.text}</p>
                  <p className="text-[12px] text-white/55">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-[11px] text-white/30 mt-12"
          >
            Usado por estudantes de medicina em todo o Brasil
          </motion.p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-[48%] bg-background relative">
        <div className="absolute top-6 left-6">
          <Button
            variant="ghost" size="sm"
            onClick={() => navigate('/')}
            className="text-muted-foreground hover:text-foreground gap-1.5 text-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </Button>
        </div>

        {/* Mobile branding */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center lg:hidden"
        >
          <img src={logoPreceptor} alt="PreceptorMED" className="h-10 w-10 rounded-lg mx-auto mb-3" />
          <h1 className="font-bold text-xl tracking-tight">PreceptorMED</h1>
          <p className="text-sm text-muted-foreground mt-1">IA para medicina</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="w-full max-w-[400px]"
        >
          {/* Tab navigation */}
          <div className="flex border-b border-border/50 mb-8">
            {(['login', 'signup'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 pb-3 text-sm font-medium transition-colors relative ${
                  activeTab === tab
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'login' ? 'Entrar' : 'Criar conta'}
                {activeTab === tab && (
                  <motion.div
                    layoutId="auth-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                  />
                )}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'login' ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Bem-vindo de volta</h2>
                  <p className="text-sm text-muted-foreground mt-1">Entre para acessar sua biblioteca de estudos</p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 text-sm font-medium"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  <svg className="mr-2.5 h-4 w-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continuar com Google
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/40" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-background px-3 text-muted-foreground">ou com email</span>
                  </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email" className="text-[13px] font-medium">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="username"
                      placeholder="seu@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      disabled={loading}
                      className="h-10 bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password" className="text-[13px] font-medium">Senha</Label>
                    <Input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="h-10 bg-background"
                    />
                  </div>
                  <Button type="submit" className="w-full h-10 font-semibold" disabled={loading}>
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando...</> : 'Entrar'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    Esqueci minha senha
                  </button>
                </form>

                {/* Forgot password inline */}
                <AnimatePresence>
                  {showForgotPassword && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
                        <div>
                          <p className="text-sm font-semibold">Recuperar senha</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Enviaremos um link para redefinir sua senha.</p>
                        </div>
                        <form onSubmit={handleForgotPassword} className="space-y-3">
                          <Input
                            type="email"
                            placeholder="seu@email.com"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            required
                            disabled={forgotLoading}
                            className="h-9 bg-background"
                          />
                          <div className="flex gap-2">
                            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForgotPassword(false)}>
                              Cancelar
                            </Button>
                            <Button type="submit" size="sm" disabled={forgotLoading} className="flex-1">
                              {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar link'}
                            </Button>
                          </div>
                        </form>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                key="signup"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Crie sua conta grátis</h2>
                  <p className="text-muted-foreground text-sm mt-1">Comece agora — sem cartão de crédito</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground border border-border/50 rounded px-2.5 py-1">
                    <CheckCircle2 className="h-3 w-3 text-primary" />
                    2 perguntas/dia grátis
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground border border-border/50 rounded px-2.5 py-1">
                    <CheckCircle2 className="h-3 w-3 text-primary" />
                    Acesso imediato
                  </span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 text-sm font-medium"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  <svg className="mr-2.5 h-4 w-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Criar conta com Google
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/40" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-background px-3 text-muted-foreground">ou com email</span>
                  </div>
                </div>

                <form onSubmit={handleSignup} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-name" className="text-[13px] font-medium">Nome completo</Label>
                    <Input id="signup-name" type="text" autoComplete="name" placeholder="Seu nome" value={signupName} onChange={(e) => setSignupName(e.target.value)} required disabled={loading} className="h-10 bg-background" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-email" className="text-[13px] font-medium">Email</Label>
                    <Input id="signup-email" type="email" autoComplete="username" placeholder="seu@email.com" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required disabled={loading} className="h-10 bg-background" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-password" className="text-[13px] font-medium">Senha</Label>
                      <Input id="signup-password" type="password" autoComplete="new-password" placeholder="Mín. 6 caracteres" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required disabled={loading} className="h-10 bg-background" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-confirm" className="text-[13px] font-medium">Confirmar</Label>
                      <Input id="signup-confirm" type="password" autoComplete="new-password" placeholder="Repita a senha" value={signupConfirmPassword} onChange={(e) => setSignupConfirmPassword(e.target.value)} required disabled={loading} className="h-10 bg-background" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-10 font-semibold" disabled={loading}>
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando conta...</> : 'Criar Conta'}
                  </Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-center text-[11px] text-muted-foreground/50 mt-8">
            Ao continuar, você concorda com os termos de uso e política de privacidade.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
