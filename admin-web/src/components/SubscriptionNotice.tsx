import { Link } from 'react-router-dom';
import type { MySubscription } from '../api/types';
import { formatDate } from '../lib/format';

/**
 * Reminder shown above every page when the subscription is late or about to
 * end — the in-app "notification de paiement" before access is cut off.
 */
export function SubscriptionNotice({ data }: { data: MySubscription | null }) {
  const subscription = data?.subscription;
  if (!subscription || data?.access || data?.is_platform_admin) return null;

  const daysLeft = subscription.days_left;
  const endsAt = subscription.ends_at;

  if (subscription.status === 'past_due' && endsAt) {
    const cutoff = new Date(endsAt);
    cutoff.setDate(cutoff.getDate() + subscription.grace_days);
    return (
      <div className="alert error subscription-notice">
        Votre abonnement est arrivé à échéance le {formatDate(endsAt)}. Sans paiement, l'accès sera suspendu le{' '}
        {formatDate(cutoff.toISOString())}. <Link to="/abonnement">Régulariser</Link>
      </div>
    );
  }

  if ((subscription.status === 'trial' || subscription.status === 'active') && endsAt && daysLeft !== null && daysLeft <= 7) {
    const what = subscription.status === 'trial' ? "Votre période d'essai" : 'Votre abonnement';
    return (
      <div className="alert subscription-notice">
        {what} se termine {daysLeft <= 0 ? "aujourd'hui" : `dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`} (
        {formatDate(endsAt)}). <Link to="/abonnement">Voir mon abonnement</Link>
      </div>
    );
  }

  return null;
}
