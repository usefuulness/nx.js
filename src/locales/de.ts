/** `nx.js/locales/de`: German. Importing it adds the strings; set `lang="de"` to use them. */
import { i18n } from '@/core/i18n';

i18n.extend('de', {
  close: 'Schließen', dismiss: 'Verwerfen', clear: 'Leeren', remove: 'Entfernen', ok: 'OK', cancel: 'Abbrechen', confirm: 'Bestätigen', loading: 'Wird geladen',
  'breadcrumb.label': 'Brotkrümelnavigation', 'progress.label': 'Fortschritt', 'drawer.label': 'Bereich', 'dialog.label': 'Dialog',
  'dialog.notice': 'Hinweis', 'dialog.confirmTitle': 'Sind Sie sicher?',
  'datepicker.previousMonth': 'Vorheriger Monat', 'datepicker.nextMonth': 'Nächster Monat', 'datepicker.choose': 'Datum auswählen',
  'combobox.empty': 'Keine Ergebnisse.', 'combobox.show': 'Optionen anzeigen', 'combobox.options': 'Optionen',
  'select.placeholder': 'Auswählen…', 'menu.open': 'Menü öffnen',
  'command.empty': 'Keine Ergebnisse gefunden.', 'command.placeholder': 'Befehl eingeben oder suchen…', 'command.commands': 'Befehle',
  'region.toggle': 'Bereich umschalten', 'panel.expand': 'Bereich erweitern', 'panel.collapse': 'Bereich reduzieren', 'panel.close': 'Bereich schließen',
  'pagination.label': 'Seitennavigation', 'pagination.previous': 'Vorherige Seite', 'pagination.next': 'Nächste Seite', 'pagination.page': 'Seite {page}',
  'pagination.status': 'Seite {page} von {pages}', 'pagination.range': '{from}–{to} von {total}', 'pagination.perPage': 'Zeilen pro Seite',
  'upload.drop': 'Dateien hierher ziehen oder klicken zum Auswählen', 'upload.dropOne': 'Datei hierher ziehen oder klicken zum Auswählen', 'upload.release': 'Zum Hinzufügen loslassen', 'upload.remove': '{name} entfernen',
  'upload.required': 'Wählen Sie mindestens eine Datei aus', 'upload.tooLarge': '{name} ist größer als {max}', 'upload.wrongType': '{name} ist kein zulässiger Dateityp',
  'upload.tooMany': { one: '{name} wurde nicht hinzugefügt: nur {count} Datei erlaubt', other: '{name} wurde nicht hinzugefügt: nur {count} Dateien erlaubt' },
  'tags.placeholder': 'Tag hinzufügen…', 'tags.remove': '{tag} entfernen', 'tags.added': '{tag} hinzugefügt', 'tags.removed': '{tag} entfernt', 'tags.duplicate': '{tag} ist bereits vorhanden',
  'tags.max': { one: 'Höchstens {count} Tag erlaubt', other: 'Höchstens {count} Tags erlaubt' }, 'tags.required': 'Fügen Sie mindestens einen Tag hinzu', 'tags.min': { one: 'Fügen Sie mindestens {count} Tag hinzu', other: 'Fügen Sie mindestens {count} Tags hinzu' },
  'splitter.resize': 'Größe der Bereiche ändern',
  'form.network': 'Der Server ist nicht erreichbar. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.',
  'form.server': 'Der Server konnte das Formular nicht verarbeiten ({status}).',
  'grid.search': 'Suchen…', 'grid.searchRows': 'Zeilen durchsuchen', 'grid.selectAll': 'Alle auswählen', 'grid.selectRow': 'Zeile auswählen',
  'grid.empty': 'Keine Daten vorhanden', 'grid.noResults': 'Keine Ergebnisse für „{query}“', 'grid.loading': 'Wird geladen…',
  'grid.yes': 'Ja', 'grid.no': 'Nein', 'grid.total': 'Summe', 'grid.subtotal': 'Zwischensumme',
  'grid.rows': { one: '{count} Zeile', other: '{count} Zeilen' },
  'grid.selected': '{count} von {total} ausgewählt', 'grid.range': '{from}–{to} von {total}', 'grid.page': 'Seite {page} von {pages}',
  'grid.previousPage': 'Vorherige Seite', 'grid.nextPage': 'Nächste Seite',
  'grid.resize': 'Breite der Spalte {label} ändern', 'grid.edit': '{label} bearbeiten', 'grid.enterNumber': 'Geben Sie eine Zahl ein',
  'grid.expand': '{label} erweitern', 'grid.collapse': '{label} reduzieren'
});
