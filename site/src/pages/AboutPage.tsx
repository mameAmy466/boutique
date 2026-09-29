import { Link } from 'react-router-dom'

const days = [
  {
    title: 'Le rayon',
    text: 'Le catalogue, les lots et le prix minimum restent liés. Une vente ne passe pas sous le coût de revient plus le bénéfice minimum : la règle est appliquée dans l’application, pas seulement rappelée à l’écran.',
  },
  {
    title: 'La caisse',
    text: 'Le ticket, la session et la facture partent de la même vente. À la clôture, l’écart entre le montant attendu et le montant déclaré reste visible, avec les créances clients.',
  },
  {
    title: 'L’équipe',
    text: 'Chaque compte porte un rôle et une boutique. On retrouve ses ventes, ses réceptions, ses sessions de caisse et ses mouvements, sans mélanger les magasins.',
  },
  {
    title: 'Le mois',
    text: 'Les dépenses, les dettes fournisseurs, le grand livre, le résultat et le bilan restent dans le même outil. Le mois se lit sans rouvrir un tableur à côté.',
  },
]

const sizes = [
  {
    title: 'Simple',
    text: 'Pour une boutique qui démarre : un point de vente, une petite équipe, une caisse et un catalogue de 500 produits. Ventes, stock et dépenses suffisent pour tenir le jour.',
  },
  {
    title: 'Pro',
    text: 'Pour une équipe qui grandit dans le même magasin : jusqu’à dix comptes et trois caisses, un catalogue plus large, les rapports avancés et l’export.',
  },
  {
    title: 'Pro Max',
    text: 'Pour plusieurs points de vente : jusqu’à cinq boutiques, trente comptes et dix caisses. Le tableau de bord commun et les transferts de stock relient les magasins.',
  },
]

export function AboutPage() {
  return (
    <section className="page">
      <div className="sheet sheet-flush">
        <div className="sheet-side">
          <p className="eyebrow">À propos</p>
          <h1>Un outil pensé pour les boutiques.</h1>
        </div>
        <div className="sheet-end">
          <p>
            Le site présente le produit et les offres. L’application sert à vendre, stocker et compter
            une fois l’accès ouvert. Les deux restent séparés : on ne gère pas la caisse depuis la
            vitrine.
          </p>
        </div>
      </div>

      <div className="about-block">
        <p className="eyebrow">L’idée</p>
        <h2>La journée du magasin, dans un seul compte.</h2>
        <p>
          De la réception d’un lot jusqu’au résultat du mois, les chiffres partent des mêmes ventes et
          des mêmes stocks. Le prix, la caisse et les dettes ne se recopient pas d’un fichier à l’autre.
        </p>
      </div>

      <ol className="timeline about-timeline">
        {days.map((day, index) => (
          <li key={day.title}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <div>
              <h3>{day.title}</h3>
              <p>{day.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="about-block">
        <p className="eyebrow">Les offres</p>
        <h2>Trois tailles, selon le magasin.</h2>
        <p>
          Simple, Pro et Pro Max fixent le nombre de boutiques, d’utilisateurs, de caisses et de
          produits. L’abonnement se confirme avec l’équipe. Le paiement en ligne n’est pas encore
          branché.
        </p>
      </div>

      <div className="about-plans">
        {sizes.map((size) => (
          <article key={size.title}>
            <h2>{size.title}</h2>
            <p>{size.text}</p>
          </article>
        ))}
      </div>

      <div className="sheet">
        <div className="sheet-side">
          <p className="eyebrow">Commencer</p>
          <h2>L’accès s’ouvre avec vous.</h2>
          <p>On confirme l’offre et les boutiques, puis la connexion se fait dans l’application.</p>
        </div>
        <div className="sheet-end">
          <p>Un message suffit pour parler du magasin, de l’équipe et de la taille qui convient.</p>
          <div className="about-actions">
            <Link className="btn btn-light" to="/contact">
              Écrire à l’équipe
            </Link>
            <Link className="btn btn-ghost" to="/tarifs">
              Voir les tarifs
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
