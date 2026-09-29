import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatFcfa, plans } from '../content'

export function PricingPage() {
  const [annual, setAnnual] = useState(false)

  return (
    <section className="page">
      <p className="eyebrow">Tarifs</p>
      <h1>Simple, Pro et Pro Max.</h1>
      <p className="lede">Le site présente les offres. L’application s’ouvre après connexion, avec l’abonnement choisi.</p>
      <div className="billing" role="group" aria-label="Période de facturation">
        <button type="button" className={annual ? '' : 'is-on'} onClick={() => setAnnual(false)}>
          Mensuel
        </button>
        <button type="button" className={annual ? 'is-on' : ''} onClick={() => setAnnual(true)}>
          Annuel
        </button>
      </div>
      <div className="price-grid">
        {plans.map((plan) => (
          <article key={plan.code} className={'featured' in plan && plan.featured ? 'price featured' : 'price'}>
            <h2>{plan.name}</h2>
            <p className="audience">{plan.audience}</p>
            <p className="amount">
              {formatFcfa(annual ? plan.annual : plan.monthly)}
              <span>{annual ? '/ an' : '/ mois'}</span>
            </p>
            <ul>
              {plan.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <Link className="btn btn-accent" to={`/contact?offre=${plan.code}`}>
              Souscrire
            </Link>
          </article>
        ))}
      </div>
    </section>
  )
}
