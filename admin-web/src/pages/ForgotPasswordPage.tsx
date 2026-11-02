import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, firstValidationError } from '../api/client';
import { AuthShell } from '../components/AuthShell';
import { PLATFORM_CONTACT } from '../lib/subscription';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<{ message: string; mail_enabled: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      setSent(await api.post<{ message: string; mail_enabled: boolean }>('/forgot-password', { email }));
    } catch (err) {
      setError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Envoi impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  const whatsappText = encodeURIComponent(`Bonjour, j'ai oublié le mot de passe de mon compte Boutique (${email}).`);

  return (
    <AuthShell
      title="Mot de passe oublié ?"
      intro="Indique l'adresse e-mail de ton compte : tu recevras un lien pour choisir un nouveau mot de passe."
      cardTitle="Réinitialisation"
    >
      {error && <div className="alert error">{error}</div>}

      {sent ? (
        <div className="reset-done">
          <p>{sent.message}</p>
          <p className="reset-hint">Pense à regarder dans les courriers indésirables.</p>
          {!sent.mail_enabled && (
            <p className="reset-hint">
              Si tu ne reçois rien, contacte-nous : nous pouvons te donner un nouveau mot de passe.
            </p>
          )}
          <a className="login-signup-btn" href={`https://wa.me/${PLATFORM_CONTACT.whatsapp}?text=${whatsappText}`} target="_blank" rel="noreferrer">
            Nous écrire sur WhatsApp
          </a>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Adresse e-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <button className="login-submit" type="submit" disabled={submitting}>
            {submitting ? 'Envoi…' : 'Recevoir le lien'}
          </button>
        </form>
      )}

      <p className="pricing-footnote">
        <Link to="/login">← Retour à la connexion</Link>
      </p>
    </AuthShell>
  );
}
