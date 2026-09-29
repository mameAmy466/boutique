import { useLayoutEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { APP_LOGIN_URL, CONTACT } from '../config'
import { Logo } from './Logo'

const links = [
  { to: '/', label: 'Accueil', end: true },
  { to: '/fonctionnalites', label: 'Fonctionnalités' },
  { to: '/tarifs', label: 'Tarifs' },
  { to: '/a-propos', label: 'À propos' },
  { to: '/contact', label: 'Contact' },
]

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.5 19.2 7.4 16A7.2 7.2 0 1 1 12 19.2a7.2 7.2 0 0 1-3.4-.8l-2.1.8Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M9.2 10.4c.2-.4.3-.4.6-.4h.4c.2 0 .3 0 .4.3.2.4.6 1.4.6 1.5.1.2 0 .3-.1.5l-.3.3c-.1.1-.2.3 0 .5.3.4.8 1 1.6 1.4.3.2.5.1.6 0l.4-.5c.1-.2.3-.1.5-.1.6.2 1.2.5 1.3.6.1.2.1.5-.1.8-.3.4-1 .9-1.6.8-.8-.1-2.2-.6-3.4-1.8-1-1-1.5-2.1-1.6-2.6-.1-.6.3-1.2.6-1.5Z"
        fill="currentColor"
      />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 4.5h2.2l1.2 3-1.6 1a12 12 0 0 0 5.7 5.7l1-1.6 3 1.2V16a2 2 0 0 1-2.2 2A14.5 14.5 0 0 1 6 6.7 2 2 0 0 1 8 4.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const revealSelector = [
  '.home-about > *',
  '.sheet-side',
  '.timeline li',
  '.sheet-end',
  '.deck-card',
  '.home-why > .eyebrow',
  '.home-why > h2',
  '.home-why li',
  '.page > .eyebrow',
  '.page > h1',
  '.page > .lede',
  '.tile',
  '.price',
  '.billing',
  '.contact-intro',
  '.contact-form',
  '.contact-aside',
  '.faq-block > *',
  '.about-block',
  '.about-plans article',
  '.prose > *',
  '.footer-main > *',
].join(', ')

export function Layout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const nodes = [...document.querySelectorAll(revealSelector)].filter(
      (el) => !el.closest('.home-hero'),
    )
    if (reduce) {
      nodes.forEach((el) => el.classList.add('is-in'))
      return
    }

    const pending = new Set<Element>()
    const timers: number[] = []
    nodes.forEach((el) => {
      const siblings = [...(el.parentElement?.children ?? [])]
      const index = Math.max(siblings.indexOf(el), 0)
      const delay = Math.min(index, 7) * 80
      el.classList.add('rise')
      el.style.animationDelay = `${delay}ms`
      pending.add(el)
    })

    const scan = () => {
      pending.forEach((el) => {
        const box = el.getBoundingClientRect()
        if (box.top < window.innerHeight * 0.92 && box.bottom > 40) {
          el.classList.add('is-in')
          pending.delete(el)
          const delay = Number.parseFloat(el.style.animationDelay) || 0
          timers.push(window.setTimeout(() => el.classList.add('shown'), delay + 900))
        }
      })
    }
    const onScroll = () => scan()
    scan()
    document.addEventListener('scroll', onScroll, { passive: true, capture: true })
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('resize', onScroll)
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [pathname])

  return (
    <div className="site">
      <header className="site-header">
        <div className="utility">
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
          <a href={CONTACT.phoneHref}>{CONTACT.phoneDisplay}</a>
          <Link className="utility-cta" to="/tarifs">
            Abonnez-vous
          </Link>
        </div>
        <div className="topbar">
          <NavLink to="/" className="brand" onClick={() => setOpen(false)}>
            <Logo />
            <span>Boutique</span>
          </NavLink>
          <button
            type="button"
            className="menu-btn"
            aria-expanded={open}
            aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
            onClick={() => setOpen((value) => !value)}
          >
            <span />
            <span />
          </button>
          <nav className={open ? 'nav open' : 'nav'}>
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <a className="nav-login" href={APP_LOGIN_URL}>
            Connexion
          </a>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="footer">
        <div className="footer-main">
          <div className="footer-brand">
            <NavLink to="/" className="brand">
              <Logo />
              <span>Boutique</span>
            </NavLink>
            <p>Ventes, stocks, dépenses et équipes, dans une seule application de gestion.</p>
          </div>
          <div className="footer-col">
            <h2>Produit</h2>
            <NavLink to="/fonctionnalites">Fonctionnalités</NavLink>
            <NavLink to="/tarifs">Tarifs</NavLink>
            <a href={APP_LOGIN_URL}>Connexion</a>
          </div>
          <div className="footer-col">
            <h2>Société</h2>
            <NavLink to="/">Accueil</NavLink>
            <NavLink to="/a-propos">À propos</NavLink>
            <NavLink to="/contact">Contact</NavLink>
          </div>
          <div className="footer-col">
            <h2>Nous suivre</h2>
            <div className="footer-follow">
              <a href={`https://wa.me/${CONTACT.whatsapp}`} target="_blank" rel="noreferrer" aria-label="WhatsApp">
                <WhatsAppIcon />
              </a>
              <a href={`mailto:${CONTACT.email}`} aria-label="E-mail">
                <MailIcon />
              </a>
              <a href={CONTACT.phoneHref} aria-label="Téléphone">
                <PhoneIcon />
              </a>
            </div>
          </div>
        </div>
        <div className="footer-bar">
          <span>© {new Date().getFullYear()} Boutique. Tous droits réservés.</span>
          <span>Gestion commerciale multi-boutiques</span>
        </div>
      </footer>
    </div>
  )
}

