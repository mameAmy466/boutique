import { Link } from 'react-router-dom';
import type { FeatureKey, MySubscription } from '../api/types';

/**
 * Shown instead of a page the client's plan does not include, when its
 * address is typed or bookmarked (the menu already hides it).
 */
export function FeatureLocked({ feature, data }: { feature: FeatureKey; data: MySubscription | null }) {
  const label = data?.feature_labels?.[feature] ?? 'Cette fonctionnalité';
  const plan = data?.subscription?.plan.name;

  return (
    <div className="access-blocked">
      <div className="card access-blocked-card">
        <h1>Non inclus dans votre formule</h1>
        <p>
          « {label} » ne fait pas partie de {plan ? `la formule ${plan}` : 'votre formule'}.
        </p>
        <div className="form-actions access-blocked-actions">
          <Link className="btn btn-primary" to="/abonnement">
            Voir les formules
          </Link>
          <Link className="btn btn-ghost" to="/">
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    </div>
  );
}
