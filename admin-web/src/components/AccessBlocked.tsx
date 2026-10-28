import type { AccessDenial } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { PLATFORM_CONTACT } from '../lib/subscription';

/** Replaces every page while the client's organization may not use the platform. */
export function AccessBlocked({ denial, onRetry }: { denial: AccessDenial; onRetry: () => void }) {
  const { logout } = useAuth();
  const title: Record<AccessDenial['code'], string> = {
    subscription_expired: 'Abonnement expiré',
    organization_closed: 'Compte fermé',
    organization_suspended: 'Accès suspendu',
    registration_pending: 'Inscription en cours de validation',
    registration_info_requested: 'Informations complémentaires demandées',
    registration_rejected: 'Inscription non acceptée',
    organization_pending_payment: 'Inscription acceptée',
  };
  const isRegistration = denial.code.startsWith('registration_') || denial.code === 'organization_pending_payment';
  const whatsappText = encodeURIComponent(
    denial.code.startsWith('registration_') || denial.code === 'organization_pending_payment'
      ? "Bonjour, je viens de m'inscrire sur Boutique et je souhaite activer ma boutique."
      : 'Bonjour, je souhaite régulariser mon abonnement Boutique.',
  );

  return (
    <div className="access-blocked">
      <div className="card access-blocked-card">
        <h1>{title[denial.code] ?? 'Accès indisponible'}</h1>
        <p>{denial.message}</p>
        <p className="hint">
          {isRegistration
            ? 'Vous serez contacté au numéro indiqué lors de votre inscription. Vous pouvez aussi nous écrire directement.'
            : 'Vos données sont conservées : elles seront de nouveau accessibles dès la réactivation.'}
        </p>
        <div className="form-actions access-blocked-actions">
          <a
            className="btn btn-primary"
            href={`https://wa.me/${PLATFORM_CONTACT.whatsapp}?text=${whatsappText}`}
            target="_blank"
            rel="noreferrer"
          >
            {isRegistration ? 'Nous écrire sur WhatsApp' : 'Payer / nous contacter sur WhatsApp'}
          </a>
          <a className="btn btn-ghost" href={PLATFORM_CONTACT.phoneHref}>
            Appeler {PLATFORM_CONTACT.phoneDisplay}
          </a>
        </div>
        <div className="form-actions access-blocked-actions">
          <button type="button" className="btn btn-ghost" onClick={onRetry}>
            {isRegistration ? 'Actualiser' : "J'ai payé, réessayer"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => logout()}>
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
