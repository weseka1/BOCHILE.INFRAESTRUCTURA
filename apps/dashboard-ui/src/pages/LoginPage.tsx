import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Lock, Mail, LogIn } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';

export function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ?next=/leads (preservar destino post-login)
  const nextParam = new URLSearchParams(location.search).get('next');
  const nextPath = nextParam && nextParam.startsWith('/') ? nextParam : '/';

  useEffect(() => {
    document.title = 'Bochile · Ingresar';
  }, []);

  // Si ya esta logueado, mandarlo al destino.
  if (!loading && isAuthenticated) {
    return <Navigate to={nextPath} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Ingresa email y contrasena');
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(nextPath, { replace: true });
    } catch (err: any) {
      const msg = err?.message || 'No pudimos iniciar sesion';
      // Mensaje user-friendly para 401
      if (/401/.test(msg)) {
        setError('Email o contrasena incorrectos');
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-surface-0 text-text">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center shadow-gold mb-3">
            <span className="font-display text-3xl font-bold text-accent-fg">B</span>
          </div>
          <div className="font-display text-2xl font-semibold leading-tight">Bochile</div>
          <div className="text-[11px] text-accent uppercase tracking-widest font-medium mt-0.5">
            Inmobiliaria · 1970
          </div>
        </div>

        {/* Card */}
        <div className="card p-6 sm:p-8">
          <h1 className="font-display text-lg font-semibold mb-1">
            <span className="text-accent mr-2">·</span>Ingresar al panel
          </h1>
          <p className="text-sm text-text-muted mb-6">
            Usa el email y contrasena que te dimos del equipo Bochile.
          </p>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-text-muted mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-9"
                  placeholder="nombre@bochile.com.ar"
                  disabled={submitting}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-text-muted mb-1.5">
                Contrasena
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-9"
                  placeholder="********"
                  disabled={submitting}
                />
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="text-sm bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg px-3 py-2"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full mt-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-accent-fg/30 border-t-accent-fg animate-spin" />
                  Ingresando...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Ingresar
                </>
              )}
            </button>
          </form>
        </div>

        <div className="text-[10px] text-text-subtle text-center mt-6 tracking-wider">
          <span className="text-accent font-medium">WESEKA · IA</span>
          <span className="mx-1.5">·</span>
          Powered by Camila Pomerich
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
