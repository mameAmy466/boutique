import type { AccessDenial } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { PLATFORM_CONTACT } from '../lib/subscription';

/** Replaces every page while the client's organization may not use the platform. */
export function AccessBlocked({ denial, onRetry }: { denial: AccessDenial; onRetry: () => void }) {
  const { logout } = useAuth();
  const title =
    denial.code === 'subscription_expired'
      ? 'Abonnement expiré'
      : denial.code === 'organization_closed'
        ? 'Compte fermé'
        : 'Accès suspendu';
  const whatsappText = encodeURIComponent('Bonjour, je souhaite régulariser mon abonnement Boutique.');

  return (
    <div className="access-blocked">
      <div className="card access-blocked-card">
        <h1>{title}</h1>
        <p>{denial.message}</p>
        <p className="hint">Vos données sont conservées : elles seront de nouveau accessibles dès la réactivation.</p>
        <div className="form-actions access-blocked-actions">
          <a
            className="btn btn-primary"
            href={`https://wa.me/${PLATFORM_CONTACT.whatsapp}?text=${whatsappText}`}
            target="_blank"
            rel="noreferrer"
          >
            Payer / nous contacter sur WhatsApp
          </a>
          <a className="btn btn-ghost" href={PLATFORM_CONTACT.phoneHref}>
            Appeler {PLATFORM_CONTACT.phoneDisplay}
          </a>
        </div>
        <div className="form-actions access-blocked-actions">
          <button type="button" className="btn btn-ghost" onClick={onRetry}>
            J'ai payé, réessayer
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => logout()}>
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
