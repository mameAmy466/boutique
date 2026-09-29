import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { PublicPlan } from '../api/types';
import { Logo } from '../components/Logo';
import { formatMoney } from '../lib/format';
import { planFeatureBullets } from '../lib/planFeatures';

const PLAN_TAGLINE: Record<string, string> = {
  simple: 'Pour une petite boutique ou un commerce avec une caisse.',
  pro: 'Pour les boutiques avec plusieurs employés et un besoin de contrôle financier.',
  pro_max: 'Pour les complexes commerciaux ayant plusieurs boutiques.',
};

export function PricingPage() {
  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [annual, setAnnual] = useState(false);

  useEffect(() => {
    api
      .get<PublicPlan[]>('/plans')
      .then(setPlans)
      .catch(() => setError('Impossible de charger les tarifs pour le moment.'));
  }, []);

  return (
    <div className="pricing-shell">
      <header className="pricing-header">
        <div className="login-brand">
          <Logo size={32} />
          <span>Boutique</span>
        </div>
        <Link to="/login" className="btn btn-ghost">
          Se connecter
        </Link>
      </header>

      <div className="pricing-intro">
        <h1>Un forfait pour chaque commerce</h1>
        <p>Gestion des ventes, du stock, des caisses et des finances — choisis ton forfait et commence en 15 jours d'essai gratuit.</p>

        <div className="pricing-toggle">
          <button type="button" className={!annual ? 'active' : ''} onClick={() => setAnnual(false)}>
            Mensuel
          </button>
          <button type="button" className={annual ? 'active' : ''} onClick={() => setAnnual(true)}>
            Annuel <span className="pricing-toggle-badge">2 mois offerts</span>
          </button>
        </div>
      </div>

      {error && <div className="alert error" style={{ maxWidth: 480, margin: '0 auto' }}>{error}</div>}

      {!plans && !error && <p style={{ textAlign: 'center' }}>Chargement des tarifs…</p>}

      {plans && (
        <div className="pricing-grid">
          {plans.map((plan) => {
            const price = annual ? plan.annual_price : plan.monthly_price;
            const isProMax = plan.code === 'pro_max';
            return (
              <div key={plan.code} className={`pricing-card${isProMax ? ' pricing-card-highlight' : ''}`}>
                {isProMax && <span className="pricing-badge">Le plus complet</span>}
                <h2>{plan.name}</h2>
                <p className="pricing-tagline">{PLAN_TAGLINE[plan.code] ?? ''}</p>
                <div className="pricing-price">
                  <strong>{formatMoney(price)}</strong>
                  <span>/ {annual ? 'an' : 'mois'}</span>
                </div>
                <Link to={`/inscription?plan=${plan.code}`} className="btn btn-primary pricing-cta">
                  Essai gratuit de 15 jours
                </Link>
                <ul className="pricing-features">
                  {planFeatureBullets(plan).map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <p className="pricing-footnote">
        Déjà un compte ? <Link to="/login">Connecte-toi ici</Link>.
      </p>
    </div>
  );
}
