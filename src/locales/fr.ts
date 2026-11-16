/** `nx.js/locales/fr`: French. Importing it adds the strings; set `lang="fr"` to use them. */
import { i18n } from '@/core/i18n';

i18n.extend('fr', {
  close: 'Fermer', dismiss: 'Ignorer', clear: 'Effacer', remove: 'Retirer', ok: 'OK', cancel: 'Annuler', confirm: 'Confirmer', loading: 'Chargement',
  'breadcrumb.label': 'Fil d’Ariane', 'progress.label': 'Progression', 'drawer.label': 'Panneau', 'dialog.label': 'Boîte de dialogue',
  'dialog.notice': 'Information', 'dialog.confirmTitle': 'Êtes-vous sûr ?',
  'datepicker.previousMonth': 'Mois précédent', 'datepicker.nextMonth': 'Mois suivant', 'datepicker.choose': 'Choisir une date',
  'combobox.empty': 'Aucun résultat.', 'combobox.show': 'Afficher les options', 'combobox.options': 'Options',
  'select.placeholder': 'Sélectionner…', 'menu.open': 'Ouvrir le menu',
  'command.empty': 'Aucun résultat trouvé.', 'command.placeholder': 'Saisissez une commande ou recherchez…', 'command.commands': 'Commandes',
  'region.toggle': 'Basculer la zone', 'panel.expand': 'Développer le panneau', 'panel.collapse': 'Réduire le panneau', 'panel.close': 'Fermer le panneau',
  'pagination.label': 'Pagination', 'pagination.previous': 'Page précédente', 'pagination.next': 'Page suivante', 'pagination.page': 'Page {page}',
  'pagination.status': 'Page {page} sur {pages}', 'pagination.range': '{from}–{to} sur {total}', 'pagination.perPage': 'Lignes par page',
  'form.network': 'Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.',
  'form.server': 'Le serveur n’a pas pu traiter le formulaire ({status}).',
  'grid.search': 'Rechercher…', 'grid.searchRows': 'Rechercher des lignes', 'grid.selectAll': 'Tout sélectionner', 'grid.selectRow': 'Sélectionner la ligne',
  'grid.empty': 'Aucune donnée à afficher', 'grid.noResults': 'Aucun résultat pour « {query} »', 'grid.loading': 'Chargement…',
  'grid.yes': 'Oui', 'grid.no': 'Non', 'grid.total': 'Total', 'grid.subtotal': 'Sous-total',
  'grid.rows': { one: '{count} ligne', other: '{count} lignes' },
  'grid.selected': '{count} sur {total} sélectionnées', 'grid.range': '{from}–{to} sur {total}', 'grid.page': 'Page {page} sur {pages}',
  'grid.previousPage': 'Page précédente', 'grid.nextPage': 'Page suivante',
  'grid.resize': 'Redimensionner la colonne {label}', 'grid.edit': 'Modifier {label}', 'grid.enterNumber': 'Saisissez un nombre',
  'grid.expand': 'Développer {label}', 'grid.collapse': 'Réduire {label}'
});
