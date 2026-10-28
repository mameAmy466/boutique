import { useEffect, useMemo, useState } from 'react';
import { api, ApiError, firstValidationError } from '../../api/client';
import type { PlansMatrix, PlatformPlan } from '../../api/types';
import { Breadcrumb } from '../../components/Breadcrumb';

/**
 * Prices, limits and features of every formula, side by side. A change
 * applies at once to every client on that formula: the API checks the same
 * values (feature: middleware) and the clients' menus follow.
 */
export function PlatformPlansPage() {
  const [matrix, setMatrix] = useState<PlansMatrix | null>(null);
  const [drafts, setDrafts] = useState<PlatformPlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function apply(response: PlansMatrix) {
    setMatrix(response);
    setDrafts(response.plans.map((p) => ({ ...p, features: { ...p.features } })));
  }

  useEffect(() => {
    api
      .get<PlansMatrix>('/platform/plans')
      .then(apply)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'));
  }, []);

  const changed = useMemo(
    () =>
      drafts.filter((draft) => {
        const original = matrix?.plans.find((p) => p.id === draft.id);
        return original && JSON.stringify(original) !== JSON.stringify(draft);
      }),
    [drafts, matrix],
  );

  function update(id: number, patch: Partial<PlatformPlan>) {
    setDrafts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setSaved(false);
  }

  function setFeature(id: number, key: string, value: string) {
    setDrafts((prev) => prev.map((p) => (p.id === id ? { ...p, features: { ...p.features, [key]: value } } : p)));
    setSaved(false);
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      let response: PlansMatrix | null = null;
      for (const plan of changed) {
        const features = Object.fromEntries(
          Object.entries(plan.features).filter(([key]) => key in (matrix?.flags ?? {}) || key in (matrix?.limits ?? {})),
        );
        response = await api.put<PlansMatrix>(`/platform/plans/${plan.id}`, {
          name: plan.name,
          monthly_price: Number(plan.monthly_price),
          annual_price: Number(plan.annual_price),
          is_active: plan.is_active,
          features,
        });
      }
      if (response) apply(response);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setSaving(false);
    }
  }

  const columns = drafts.length + 1;

  return (
    <>
      <Breadcrumb items={[{ label: 'Super Admin', to: '/plateforme' }, { label: 'Formules et fonctionnalités' }]} />
      {error && <div className="alert error">{error}</div>}

      <div className="catalog-heading">
        <div>
          <h1>Formules et fonctionnalités</h1>
          <p>Cochez ce que chaque formule inclut. Les clients voient leurs menus changer dès leur prochain chargement.</p>
        </div>
      </div>

      {matrix && (
        <section className="catalog-history">
          <div className="table-wrap table-scroll">
            <table className="plans-matrix">
              <thead>
                <tr>
                  <th>Formule</th>
                  {drafts.map((plan) => (
                    <th key={plan.id} className="plan-cell">
                      {plan.name}
                      <span className="feature-desc">
                        {plan.subscriptions_count} client{plan.subscriptions_count > 1 ? 's' : ''}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="matrix-section">
                  <td colSpan={columns}>Tarifs</td>
                </tr>
                <tr>
                  <td>Nom affiché</td>
                  {drafts.map((plan) => (
                    <td key={plan.id} className="plan-cell">
                      <input type="text" aria-label={`Nom ${plan.code}`} value={plan.name} onChange={(e) => update(plan.id, { name: e.target.value })} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Prix mensuel (FCFA)</td>
                  {drafts.map((plan) => (
                    <td key={plan.id} className="plan-cell">
                      <input
                        type="number"
                        min={0}
                        aria-label={`Prix mensuel ${plan.name}`}
                        value={plan.monthly_price}
                        onChange={(e) => update(plan.id, { monthly_price: Number(e.target.value) })}
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Prix annuel (FCFA)</td>
                  {drafts.map((plan) => (
                    <td key={plan.id} className="plan-cell">
                      <input
                        type="number"
                        min={0}
                        aria-label={`Prix annuel ${plan.name}`}
                        value={plan.annual_price}
                        onChange={(e) => update(plan.id, { annual_price: Number(e.target.value) })}
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Proposée à l'inscription</td>
                  {drafts.map((plan) => (
                    <td key={plan.id} className="plan-cell">
                      <input
                        type="checkbox"
                        aria-label={`${plan.name} proposée à l'inscription`}
                        checked={plan.is_active}
                        onChange={(e) => update(plan.id, { is_active: e.target.checked })}
                      />
                    </td>
                  ))}
                </tr>

                <tr className="matrix-section">
                  <td colSpan={columns}>Toujours inclus</td>
                </tr>
                {matrix.core.map((label) => (
                  <tr key={label}>
                    <td>{label}</td>
                    {drafts.map((plan) => (
                      <td key={plan.id} className="plan-cell">
                        <input type="checkbox" checked disabled aria-label={`${label} — ${plan.name}`} />
                      </td>
                    ))}
                  </tr>
                ))}

                <tr className="matrix-section">
                  <td colSpan={columns}>Fonctionnalités</td>
                </tr>
                {Object.entries(matrix.flags).map(([key, flag]) => (
                  <tr key={key}>
                    <td>
                      {flag.label}
                      <span className="feature-desc">{flag.description}</span>
                    </td>
                    {drafts.map((plan) => (
                      <td key={plan.id} className="plan-cell">
                        <input
                          type="checkbox"
                          aria-label={`${flag.label} — ${plan.name}`}
                          checked={plan.features[key] === 'true'}
                          onChange={(e) => setFeature(plan.id, key, e.target.checked ? 'true' : 'false')}
                        />
                      </td>
                    ))}
                  </tr>
                ))}

                <tr className="matrix-section">
                  <td colSpan={columns}>Limites</td>
                </tr>
                {Object.entries(matrix.limits).map(([key, limit]) => (
                  <tr key={key}>
                    <td>{limit.label} (maximum)</td>
                    {drafts.map((plan) => {
                      const value = plan.features[key] ?? '0';
                      const unlimited = value === 'unlimited';
                      return (
                        <td key={plan.id} className="plan-cell">
                          <div className="plan-limit">
                            <input
                              type="number"
                              min={0}
                              aria-label={`${limit.label} — ${plan.name}`}
                              disabled={unlimited}
                              value={unlimited ? '' : value}
                              placeholder={unlimited ? '∞' : ''}
                              onChange={(e) => setFeature(plan.id, key, e.target.value || '0')}
                            />
                            <label className="plan-check">
                              <input
                                type="checkbox"
                                checked={unlimited}
                                onChange={(e) => setFeature(plan.id, key, e.target.checked ? 'unlimited' : '1')}
                              />
                              ∞
                            </label>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="matrix-actions">
            {saved && changed.length === 0 && <span className="hint">Enregistré.</span>}
            {changed.length > 0 && (
              <span className="hint">
                {changed.length} formule{changed.length > 1 ? 's' : ''} modifiée{changed.length > 1 ? 's' : ''}
              </span>
            )}
            <button type="button" className="btn btn-primary" disabled={saving || changed.length === 0} onClick={save}>
              {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
