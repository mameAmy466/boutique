import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CONTACT } from '../config'
import { plans } from '../content'

const faqs = [
  {
    q: 'Comment choisir une offre ?',
    a: 'Simple convient à une boutique qui démarre, Pro à une équipe plus large, Pro Max à plusieurs points de vente. Les plafonds et les prix sont sur la page Tarifs.',
  },
  {
    q: 'Comment ouvrir l’accès ?',
    a: 'Le formulaire ouvre WhatsApp avec votre nom, votre téléphone et l’offre choisie. L’accès se confirme ensuite, puis la connexion se fait dans l’application.',
  },
  {
    q: 'Wave ou Orange Money est-il branché ?',
    a: 'Le paiement en ligne n’est pas branché. L’abonnement se confirme par WhatsApp ou par téléphone.',
  },
  {
    q: 'Je gère plusieurs boutiques.',
    a: 'Pro Max couvre jusqu’à cinq boutiques, les équipes, le tableau de bord commun et les transferts de stock.',
  },
]

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {children}
    </svg>
  )
}

export function ContactPage() {
  const [params] = useSearchParams()
  const [sent, setSent] = useState<string | null>(null)
  const initialOffer = params.get('offre') ?? ''
  const initialSubject = params.get('sujet') ?? ''

  const offerName = useMemo(
    () => plans.find((plan) => plan.code === initialOffer)?.name ?? '',
    [initialOffer],
  )

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = String(data.get('nom') ?? '').trim()
    const phone = String(data.get('telephone') ?? '').trim()
    const offer = String(data.get('offre') ?? '').trim()
    const message = String(data.get('message') ?? '').trim()
    const text = [
      `Bonjour, je suis ${name}.`,
      phone ? `Téléphone : ${phone}.` : '',
      offer ? `Offre : ${offer}.` : '',
      message,
    ]
      .filter(Boolean)
      .join('\n')
    const url = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(text)}`
    setSent(url)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="page contact">
      <header className="contact-intro">
        <h1>Écrire à l’équipe.</h1>
        <p>WhatsApp, téléphone ou formulaire. Nous revenons vers vous pour ouvrir l’accès.</p>
      </header>

      <div className="contact-grid">
        <form className="contact-form" onSubmit={handleSubmit}>
          <h2>Écrivez-nous</h2>
          <div className="contact-row">
            <label>
              <span className="sr-only">Nom</span>
              <input name="nom" required placeholder="Votre nom" />
            </label>
            <label>
              <span className="sr-only">Téléphone</span>
              <input name="telephone" required placeholder="Votre téléphone" />
            </label>
          </div>
          <label>
            <span className="sr-only">Offre</span>
            <select name="offre" defaultValue={offerName}>
              <option value="">Offre souhaitée</option>
              {plans.map((plan) => (
                <option key={plan.code}>{plan.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Message</span>
            <textarea
              name="message"
              rows={6}
              required
              defaultValue={initialSubject}
              placeholder="Votre boutique, votre ville…"
            />
          </label>
          <button className="btn contact-send" type="submit">
            Envoyer
          </button>
          {sent && (
            <p className="form-note">
              Si WhatsApp ne s’est pas ouvert, <a href={sent}>cliquez ici</a>.
            </p>
          )}
        </form>

        <aside className="contact-aside">
          <h2>Coordonnées</h2>
          <p>Un message suffit pour parler de la boutique, de l’équipe et de l’offre.</p>
          <div className="detail-grid">
            <a className="detail-card" href={`https://wa.me/${CONTACT.whatsapp}`} target="_blank" rel="noreferrer">
              <span>
                <Icon>
                  <path
                    d="M6.5 19.2 7.4 16A7.2 7.2 0 1 1 12 19.2a7.2 7.2 0 0 1-3.4-.8l-2.1.8Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                </Icon>
              </span>
              <div>
                <strong>WhatsApp</strong>
                <em>{CONTACT.phoneDisplay}</em>
              </div>
            </a>
            <a className="detail-card" href={CONTACT.phoneHref}>
              <span>
                <Icon>
                  <path
                    d="M8 4.5h2.2l1.2 3-1.6 1a12 12 0 0 0 5.7 5.7l1-1.6 3 1.2V16a2 2 0 0 1-2.2 2A14.5 14.5 0 0 1 6 6.7 2 2 0 0 1 8 4.5Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </Icon>
              </span>
              <div>
                <strong>Téléphone</strong>
                <em>{CONTACT.phoneDisplay}</em>
              </div>
            </a>
            <a className="detail-card" href={`mailto:${CONTACT.email}`}>
              <span>
                <Icon>
                  <rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
                  <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.6" />
                </Icon>
              </span>
              <div>
                <strong>E-mail</strong>
                <em>{CONTACT.email}</em>
              </div>
            </a>
            <Link className="detail-card" to="/tarifs">
              <span>
                <Icon>
                  <path d="M5 7.5h14v11H5v-11Z" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M5 11.5h14M9 4.5v4M15 4.5v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </Icon>
              </span>
              <div>
                <strong>Offres</strong>
                <em>Simple, Pro, Pro Max</em>
              </div>
            </Link>
          </div>
          <p className="contact-social-label">Nous écrire</p>
          <div className="contact-social">
            <a href={`https://wa.me/${CONTACT.whatsapp}`} target="_blank" rel="noreferrer" aria-label="WhatsApp">
              <Icon>
                <path
                  d="M6.5 19.2 7.4 16A7.2 7.2 0 1 1 12 19.2a7.2 7.2 0 0 1-3.4-.8l-2.1.8Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
              </Icon>
            </a>
            <a href={`mailto:${CONTACT.email}`} aria-label="E-mail">
              <Icon>
                <rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.6" />
              </Icon>
            </a>
            <a href={CONTACT.phoneHref} aria-label="Téléphone">
              <Icon>
                <path
                  d="M8 4.5h2.2l1.2 3-1.6 1a12 12 0 0 0 5.7 5.7l1-1.6 3 1.2V16a2 2 0 0 1-2.2 2A14.5 14.5 0 0 1 6 6.7 2 2 0 0 1 8 4.5Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </Icon>
            </a>
          </div>
        </aside>
      </div>

      <div className="faq-block">
        <header>
          <h2>Les questions qui reviennent.</h2>
          <p>L’abonnement, l’ouverture du compte et les boutiques, en quelques réponses.</p>
        </header>
        <div className="faq-grid">
          <div className="faq-list">
            {faqs.map((item, index) => (
              <details
                key={item.q}
                {...(index === 0 ? { open: true } : {})}
                onToggle={(event) => {
                  const current = event.currentTarget
                  if (!current.open) return
                  current.parentElement?.querySelectorAll('details').forEach((other) => {
                    if (other !== current) other.open = false
                  })
                }}
              >
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
          <aside className="faq-side">
            <p className="eyebrow">Après l’envoi</p>
            <ol>
              <li>WhatsApp s’ouvre avec votre message.</li>
              <li>On confirme l’offre et les boutiques.</li>
              <li>L’accès à l’application est ouvert.</li>
            </ol>
          </aside>
        </div>
      </div>
    </section>
  )
}
