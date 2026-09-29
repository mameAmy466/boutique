import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

const stages = [
  {
    title: 'Ventes',
    text: 'Le tableau de bord réunit les ventes, le bénéfice et la comparaison des boutiques. Le ticket, le détail et la facture restent sur la même liste.',
  },
  {
    title: 'Stock',
    text: 'Le catalogue montre le prix et le stock de chaque article. Les lots se réceptionnent avec un prix minimum, et l’inventaire donne la valeur par boutique et par produit.',
  },
  {
    title: 'Caisse et équipe',
    text: 'Chaque caisse s’ouvre, se clôture et affiche son écart. Les boutiques ont leur fiche, les comptes de l’équipe leur rôle et leur activité.',
  },
]

function ReasonIcon({ name }: { name: 'price' | 'cash' | 'shops' | 'books' }) {
  if (name === 'price') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3.5 19.5 7v5.2c0 4.2-3 6.8-7.5 8.3C7.5 19 4.5 16.4 4.5 12.2V7L12 3.5Z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9 12.2 11 14.2 15.2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'cash') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.5" y="6" width="17" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3.5 10h17M8 14.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'shops') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 10.5 6 5.5h12l2 5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M5 10.5h14V19H5v-8.5Z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 19v-4.5h4V19" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    )
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 4.5h8.5L19 8v11.5H7V4.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M15.5 4.5V8H19M10 12h5M10 15.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

const reasons = [
  { title: 'Prix protégé', text: 'Aucune vente sous le coût de revient plus le bénéfice minimum.', icon: 'price' as const },
  { title: 'Caisse claire', text: 'Ouverture, encaissement et clôture, avec la facture du ticket.', icon: 'cash' as const },
  { title: 'Plusieurs boutiques', text: 'Équipes, stocks et transferts suivis depuis le même compte.', icon: 'shops' as const },
  { title: 'Comptes à jour', text: 'Dépenses, grand livre, résultat et bilan dans la même application.', icon: 'books' as const },
]

export function HomePage() {
  const tiltRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const tilt = tiltRef.current
    if (!tilt) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    let frame = 0
    let armed = false
    const apply = () => {
      const progress = Math.min(Math.max(window.scrollY, 0) / 420, 1)
      const rx = 8 - progress * 8
      const ry = -10 + progress * 10
      tilt.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`
    }
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(apply)
    }
    const arm = () => {
      if (armed) return
      armed = true
      apply()
      window.addEventListener('scroll', onScroll, { passive: true })
    }
    tilt.addEventListener('animationend', arm)
    const backup = window.setTimeout(arm, 1600)
    return () => {
      tilt.removeEventListener('animationend', arm)
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
      window.clearTimeout(backup)
    }
  }, [])

  return (
    <>
      <section className="home-hero">
        <div className="home-hero-row">
          <div className="home-hero-copy">
            <p className="eyebrow">Logiciel de gestion commerciale</p>
            <h1>Gérez votre boutique avec une équipe outillée.</h1>
            <p>Ventes, stocks, dépenses et caisses, sur une seule plateforme.</p>
            <Link className="btn btn-light" to="/tarifs">
              Voir les offres
            </Link>
          </div>
          <div className="hero-stage">
            <div className="hero-tilt" ref={tiltRef}>
              <div className="hero-float">
                <img src="/app/dashboard.png" alt="Tableau de bord de l’application" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-about">
        <div className="stat">
          <strong>3</strong>
          <span>offres Simple, Pro et Pro Max</span>
        </div>
        <div>
          <p className="eyebrow">À propos</p>
          <h2>Tout le commerce, tenu au même endroit.</h2>
        </div>
        <div>
          <p>
            De la réception d’un lot jusqu’au résultat du mois : le prix minimum, la caisse et les
            dettes restent dans le même outil.
          </p>
          <Link className="btn btn-ghost" to="/a-propos">
            Continuer
          </Link>
        </div>
      </section>

      <section className="sheet">
        <div className="sheet-side">
          <p className="eyebrow">L’application</p>
          <h2>Les écrans du quotidien.</h2>
          <p>Une journée de boutique, du chiffre du matin jusqu’au compte de l’équipe.</p>
          <Link className="btn btn-ghost" to="/fonctionnalites">
            Voir les fonctionnalités
          </Link>
        </div>
        <ol className="timeline">
          {stages.map((stage, index) => (
            <li key={stage.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{stage.title}</h3>
                <p>{stage.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-why">
        <p className="eyebrow">Pourquoi Boutique</p>
        <h2>Un quotidien de magasin, sans tableur à côté.</h2>
        <ul>
          {reasons.map((reason) => (
            <li key={reason.title}>
              <div className="reason-head">
                <span>
                  <ReasonIcon name={reason.icon} />
                </span>
                <strong>{reason.title}</strong>
              </div>
              <p>{reason.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="sheet">
        <div className="sheet-side">
          <p className="eyebrow">Démo</p>
          <h2>Ouvrez une caisse d’essai avec votre équipe.</h2>
          <p>Un magasin d’essai pour encaisser, réceptionner un lot et lire le résultat du mois.</p>
        </div>
        <div className="sheet-end">
          <p>On ouvre l’accès avec vous, sur vos boutiques et votre équipe.</p>
          <Link className="btn btn-light" to="/tarifs">
            Abonnez-vous
          </Link>
        </div>
      </section>
    </>
  )
}
