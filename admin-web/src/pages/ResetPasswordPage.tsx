import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError, firstValidationError } from '../api/client';
import { AuthShell } from '../components/AuthShell';

/** Opened from the link of the reset e-mail (token and e-mail in the address). */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const email = params.get('email') ?? '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmation) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/reset-password', { token, email, password, password_confirmation: confirmation });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Modification impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Nouveau mot de passe" intro={email ? `Compte : ${email}` : 'Choisis ton nouveau mot de passe.'} cardTitle="Nouveau mot de passe">
      {!token || !email ? (
        <div className="reset-done">
          <p>Ce lien est incomplet. Ouvre le lien reçu par e-mail, ou demande-en un nouveau.</p>
          <Link className="login-signup-btn" to="/mot-de-passe-oublie">
            Demander un nouveau lien
          </Link>
        </div>
      ) : done ? (
        <div className="reset-done">
          <p>Ton mot de passe a été modifié.</p>
          <Link className="login-submit reset-cta" to="/login">
            Se connecter
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && <div className="alert error">{error}</div>}
          <div className="field">
            <label htmlFor="password">Nouveau mot de passe</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="password_confirmation">Confirmer le mot de passe</label>
            <input
              id="password_confirmation"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              required
            />
          </div>
          <button className="login-submit" type="submit" disabled={submitting}>
            {submitting ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
          </button>
          {error && (
            <p className="pricing-footnote">
              <Link to="/mot-de-passe-oublie">Demander un nouveau lien</Link>
            </p>
          )}
        </form>
      )}

      <p className="pricing-footnote">
        <Link to="/login">← Retour à la connexion</Link>
      </p>
    </AuthShell>
  );
}
