import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, firstValidationError } from '../../api/client';
import type { PlatformOrganization } from '../../api/types';
import { ApproveRegistrationModal } from '../../components/ApproveRegistrationModal';
import { Breadcrumb } from '../../components/Breadcrumb';
import { formatShortDate } from '../../lib/format';
import { REGISTRATION_STATUS_BADGE, REGISTRATION_STATUS_LABEL } from '../../lib/subscription';

const TABS = [
  { value: 'open', label: 'À traiter' },
  { value: 'awaiting_activation', label: 'Acceptées, à activer' },
  { value: 'rejected', label: 'Refusées' },
  { value: 'all', label: 'Toutes' },
] as const;

/** Shops that signed up themselves: nothing is usable until they are accepted here. */
export function PlatformRegistrationsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('open');
  const [rows, setRows] = useState<PlatformOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<PlatformOrganization | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  function load() {
    setLoading(true);
    api
      .get<PlatformOrganization[]>(`/platform/registrations?status=${tab}`)
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [tab]);

  async function act(o: PlatformOrganization, path: 'reject' | 'request-info') {
    const text =
      path === 'reject'
        ? window.prompt(`Refuser la demande de « ${o.name} » ? Motif communiqué au client (facultatif) :`, '')
        : window.prompt(`Quelles informations demander à « ${o.name} » ?`, '');
    if (text === null || (path === 'request-info' && !text.trim())) return;
    setBusyId(o.id);
    setError(null);
    try {
      await api.post(`/platform/organizations/${o.id}/${path}`, path === 'reject' ? { reason: text || null } : { message: text });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Breadcrumb items={[{ label: 'Super Admin', to: '/plateforme' }, { label: "Demandes d'inscription" }]} />
      {error && <div className="alert error">{error}</div>}

      <div className="catalog-heading">
        <div>
          <h1>Demandes d'inscription</h1>
          <p>Une boutique inscrite reste inactive tant que vous ne l'avez pas acceptée et activée.</p>
        </div>
      </div>

      <section className="catalog-history">
        <div className="tab-row">
          {TABS.map((t) => (
            <button key={t.value} type="button" className={`btn btn-sm${tab === t.value ? ' btn-primary' : ''}`} onClick={() => setTab(t.value)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="table-wrap table-scroll cards-sm">
          <table>
            <thead>
              <tr>
                <th>Boutique</th>
                <th>Responsable</th>
                <th>Formule demandée</th>
                <th>Inscription</th>
                <th>Demande</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr className="empty-row">
                  <td colSpan={6}>Chargement…</td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr className="empty-row">
                  <td colSpan={6}>Aucune demande ici.</td>
                </tr>
              )}
              {rows.map((o) => (
                <tr key={o.id}>
                  <td data-label="Boutique">
                    <Link to={`/plateforme/clients/${o.id}`}>{o.name}</Link> <span className="hint">#{o.id}</span>
                    {o.phone && <div className="hint">{o.phone}</div>}
                  </td>
                  <td data-label="Responsable">
                    {o.owner?.name ?? '—'}
                    {o.owner?.email && <div className="hint">{o.owner.email}</div>}
                  </td>
                  <td data-label="Formule">{o.subscription?.plan?.name ?? '—'}</td>
                  <td data-label="Inscription">{formatShortDate(o.created_at)}</td>
                  <td data-label="Demande">
                    <span className={`badge ${REGISTRATION_STATUS_BADGE[o.registration_status]}`}>
                      {REGISTRATION_STATUS_LABEL[o.registration_status]}
                    </span>
                    {o.registration_note && <div className="hint">{o.registration_note}</div>}
                  </td>
                  <td data-label="Actions">
                    <div className="row-actions">
                      {o.status === 'inactive' && (
                        <button type="button" className="btn btn-sm btn-primary" disabled={busyId === o.id} onClick={() => setApproving(o)}>
                          {o.registration_status === 'approved' ? 'Activer' : 'Accepter'}
                        </button>
                      )}
                      {(o.registration_status === 'pending' || o.registration_status === 'info_requested') && (
                        <button type="button" className="btn btn-sm" disabled={busyId === o.id} onClick={() => act(o, 'request-info')}>
                          Demander des infos
                        </button>
                      )}
                      {o.status === 'inactive' && o.registration_status !== 'rejected' && (
                        <button type="button" className="btn btn-sm btn-danger" disabled={busyId === o.id} onClick={() => act(o, 'reject')}>
                          Refuser
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {approving && (
        <ApproveRegistrationModal
          organization={approving}
          onClose={() => setApproving(null)}
          onDone={() => {
            setApproving(null);
            load();
          }}
        />
      )}
    </>
  );
}
