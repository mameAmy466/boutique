const groups = [
  {
    title: 'Tableau de bord',
    text: 'Une vue du jour pour savoir où en est le magasin, sans ouvrir chaque liste.',
    items: [
      'Ventes du jour, de la semaine et du mois',
      'Bénéfice et chiffre d’affaires',
      'Comparaison des boutiques',
      'Activité récente et produits les plus vendus',
    ],
  },
  {
    title: 'Produits et stock',
    text: 'Le catalogue et les lots restent liés : le prix affiché ne descend pas sous le coût.',
    items: [
      'Catalogue, catégories et prix',
      'Stock disponible par article',
      'Réception de lots',
      'Prix minimum calculé sur le coût de revient',
      'Alertes de rupture',
    ],
  },
  {
    title: 'Inventaire',
    text: 'La valeur du stock est lue boutique par boutique, puis produit par produit.',
    items: [
      'Valeur au coût et valeur potentielle à la vente',
      'Quantité disponible et lots actifs',
      'Répartition par boutique',
      'Répartition par produit',
    ],
  },
  {
    title: 'Ventes et caisse',
    text: 'Le ticket, la session de caisse et la facture partent de la même vente.',
    items: [
      'Ticket de caisse et détail de la vente',
      'Facture du ticket',
      'Ouverture, encaissement et clôture',
      'Écart entre le montant attendu et le montant déclaré',
      'Créances clients',
    ],
  },
  {
    title: 'Boutiques',
    text: 'Chaque magasin a sa fiche, son activité et son chiffre, dans le même compte.',
    items: [
      'Fiche boutique, responsable et budget',
      'Activité et chiffre d’affaires',
      'Plusieurs points de vente',
      'Transferts de stock entre boutiques',
    ],
  },
  {
    title: 'Équipe',
    text: 'Les comptes portent un rôle, une boutique et l’historique de ce qu’ils font.',
    items: [
      'Comptes et rôles',
      'Affectation à une boutique',
      'Ventes, stock, caisse et mouvements du compte',
      'Statut actif ou inactif',
    ],
  },
  {
    title: 'Comptabilité',
    text: 'Les dépenses du mois arrivent jusqu’au résultat et au bilan, dans la même application.',
    items: [
      'Dépenses et salariés',
      'Grand livre et balance',
      'Compte de résultat et bilan',
      'Rapprochement bancaire',
    ],
  },
  {
    title: 'Fournisseurs et achats',
    text: 'La commande, la réception et la dette fournisseur se suivent sans tableur à côté.',
    items: [
      'Fiches fournisseurs',
      'Bons de commande',
      'Dettes fournisseurs',
      'Réception rattachée à l’achat',
    ],
  },
]

export function FeaturesPage() {
  return (
    <section className="page">
      <div className="sheet sheet-flush">
        <div className="sheet-side">
          <p className="eyebrow">Fonctionnalités</p>
          <h1>Stocks, ventes, caisse, comptabilité et fournisseurs.</h1>
        </div>
        <div className="sheet-end">
          <p>L’application reprend le quotidien d’une boutique, du rayon jusqu’au résultat du mois.</p>
        </div>
      </div>
      <div className="deck">
        {groups.map((group, index) => (
          <article key={group.title} className={index % 2 === 0 ? 'deck-card' : 'deck-card is-accent'}>
            <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <h2>{group.title}</h2>
            <p>{group.text}</p>
            <ul>
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}
