import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { Logo } from '../components/Logo';
import { GoogleSignInButton, GOOGLE_SIGN_IN_AVAILABLE } from '../components/GoogleSignInButton';

export function LoginPage() {
  const { user, loading, login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Connexion impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleCredential(idToken: string) {
    setError(null);
    try {
      const result = await loginWithGoogle(idToken);
      if (result.needsRegistration) {
        navigate('/inscription?plan=pro', {
          state: { googleIdToken: idToken, googleEmail: result.email, googleName: result.name },
        });
        return;
      }
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Connexion Google impossible.');
    }
  }

  return (
    <div className="login-shell">
      <div className="login-decor" aria-hidden="true">
        <span className="login-shape login-shape-ring" />
        <span className="login-shape login-shape-pill" />
        <span className="login-shape login-shape-line" />
        <span className="login-shape login-shape-arc" />
        <span className="login-shape login-shape-dot" />
      </div>

      <div className="login-panel">
        <div className="login-welcome">
          <div className="login-brand">
            <Logo size={36} />
            <span>Boutique</span>
          </div>
          <h1>Bienvenue !</h1>
          <p>
            Accédez à l'interface d'administration du complexe commercial : ventes, stock, boutiques
            et équipes, au même endroit.
          </p>
        </div>

        <div className="login-form-card">
          <h2>Connexion</h2>

          {error && <div className="alert error">{error}</div>}

          {GOOGLE_SIGN_IN_AVAILABLE && (
            <>
              <div className="google-signin-row">
                <GoogleSignInButton text="signin_with" onCredential={handleGoogleCredential} />
              </div>
              <div className="auth-divider">
                <span>ou</span>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Adresse e-mail</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="admin@boutique.test"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">Mot de passe</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button className="login-submit" type="submit" disabled={submitting}>
              {submitting ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>

          <p className="pricing-footnote">
            Pas encore de compte ? <Link to="/tarifs">Voir les offres</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
