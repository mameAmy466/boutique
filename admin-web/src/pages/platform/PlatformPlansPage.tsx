import { useEffect, useState } from 'react';
import { api, ApiError, firstValidationError } from '../../api/client';
import type { FeatureDefinition, PlatformPlan } from '../../api/types';
import { Breadcrumb } from '../../components/Breadcrumb';

interface PlansResponse {
  plans: PlatformPlan[];
  feature_definitions: Record<string, FeatureDefinition>;
}

/** Prices and what each formula includes. Changes apply to every client on that formula at once. */
export function PlatformPlansPage() {
  const [data, setData] = useState<PlansResponse | null>(null);
  const [drafts, setDrafts] = useState<Record<number, PlatformPlan>>({});
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  function apply(response: PlansResponse) {
    setData(response);
    setDrafts(Object.fromEntries(response.plans.map((p) => [p.id, { ...p, features: { ...p.features } }])));
  }

  useEffect(() => {
    api
      .get<PlansResponse>('/platform/plans')
      .then(apply)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'));
  }, []);

  function update(id: number, patch: Partial<PlatformPlan>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    setSavedId(null);
  }

  function updateFeature(id: number, key: string, value: string) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], features: { ...prev[id].features, [key]: value } } }));
    setSavedId(null);
  }

  async function save(plan: PlatformPlan) {
    setError(null);
    setSavingId(plan.id);
    try {
      const response = await api.put<PlansResponse>(`/platform/plans/${plan.id}`, {
        name: plan.name,
        monthly_price: Number(plan.monthly_price),
        annual_price: Number(plan.annual_price),
        is_active: plan.is_active,
        features: plan.features,
      });
      apply(response);
      setSavedId(plan.id);
    } catch (err) {
      setError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setSavingId(null);
    }
  }

  const definitions = data?.feature_definitions ?? {};

  return (
    <>
      <Breadcrumb items={[{ label: 'Super Admin', to: '/plateforme' }, { label: 'Formules' }]} />
      {error && <div className="alert error">{error}</div>}

      <div className="catalog-heading">
        <div>
          <h1>Formules</h1>
          <p>Tarifs et fonctionnalités de chaque formule. Un changement s'applique tout de suite à tous les clients concernés.</p>
        </div>
      </div>

      <div className="plans-grid">
        {data?.plans.map((original) => {
          const plan = drafts[original.id] ?? original;
          return (
            <section className="card" key={plan.id}>
              <div className="card-head-row">
                <h2>{original.name}</h2>
                <span className="hint">
                  {original.subscriptions_count} client{original.subscriptions_count > 1 ? 's' : ''}
                </span>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor={`name-${plan.id}`}>Nom</label>
                  <input id={`name-${plan.id}`} value={plan.name} onChange={(e) => update(plan.id, { name: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor={`monthly-${plan.id}`}>Prix mensuel (FCFA)</label>
                  <input
                    id={`monthly-${plan.id}`}
                    type="number"
                    min={0}
                    value={plan.monthly_price}
                    onChange={(e) => update(plan.id, { monthly_price: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`annual-${plan.id}`}>Prix annuel (FCFA)</label>
                  <input
                    id={`annual-${plan.id}`}
                    type="number"
                    min={0}
                    value={plan.annual_price}
                    onChange={(e) => update(plan.id, { annual_price: Number(e.target.value) })}
                  />
                </div>
              </div>

              <h3>Limites</h3>
              <div className="form-grid">
                {Object.entries(definitions)
                  .filter(([, def]) => def.type === 'limit')
                  .map(([key, def]) => {
                    const value = plan.features[key] ?? '0';
                    const unlimited = value === 'unlimited';
                    return (
                      <div className="field" key={key}>
                        <label htmlFor={`${key}-${plan.id}`}>{def.label}</label>
                        <div className="plan-limit">
                          <input
                            id={`${key}-${plan.id}`}
                            type="number"
                            min={0}
                            disabled={unlimited}
                            value={unlimited ? '' : value}
                            placeholder={unlimited ? 'Illimité' : ''}
                            onChange={(e) => updateFeature(plan.id, key, e.target.value || '0')}
                          />
                          <label className="plan-check">
                            <input
                              type="checkbox"
                              checked={unlimited}
                              onChange={(e) => updateFeature(plan.id, key, e.target.checked ? 'unlimited' : '1')}
                            />
                            Illimité
                          </label>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <h3>Fonctionnalités</h3>
              <div className="plan-flags">
                {Object.entries(definitions)
                  .filter(([, def]) => def.type === 'flag')
                  .map(([key, def]) => (
                    <label className="plan-check" key={key}>
                      <input
                        type="checkbox"
                        checked={plan.features[key] === 'true'}
                        onChange={(e) => updateFeature(plan.id, key, e.target.checked ? 'true' : 'false')}
                      />
                      {def.label}
                    </label>
                  ))}
                <label className="plan-check">
                  <input type="checkbox" checked={plan.is_active} onChange={(e) => update(plan.id, { is_active: e.target.checked })} />
                  Proposée à l'inscription
                </label>
              </div>

              <div className="form-actions" style={{ marginTop: 16 }}>
                <button type="button" className="btn btn-primary" disabled={savingId === plan.id} onClick={() => save(plan)}>
                  {savingId === plan.id ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                {savedId === plan.id && <span className="hint">Enregistré.</span>}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
