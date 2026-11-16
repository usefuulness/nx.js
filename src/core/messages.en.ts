/**
 * @file @/core/messages.en.ts
 *
 * The built-in English strings. Every other locale is a partial copy of this catalogue, and
 * anything it leaves out falls back to these.
 */
import type { Messages } from '@/core/i18n';

export const en: Messages = {
  // Shared
  close: 'Close',
  dismiss: 'Dismiss',
  clear: 'Clear',
  remove: 'Remove',
  ok: 'OK',
  cancel: 'Cancel',
  confirm: 'Confirm',
  loading: 'Loading',

  // Components
  'breadcrumb.label': 'Breadcrumb',
  'progress.label': 'Progress',
  'drawer.label': 'Panel',
  'dialog.label': 'Dialog',
  'dialog.notice': 'Notice',
  'dialog.confirmTitle': 'Are you sure?',
  'datepicker.previousMonth': 'Previous month',
  'datepicker.nextMonth': 'Next month',
  'datepicker.choose': 'Choose date',
  'combobox.empty': 'No results.',
  'combobox.show': 'Show options',
  'combobox.options': 'Options',
  'select.placeholder': 'Select…',
  'menu.open': 'Open menu',
  'command.empty': 'No results found.',
  'command.placeholder': 'Type a command or search…',
  'command.commands': 'Commands',
  'region.toggle': 'Toggle region',
  'panel.expand': 'Expand panel',
  'panel.collapse': 'Collapse panel',
  'panel.close': 'Close panel',

  'pagination.label': 'Pagination',
  'pagination.previous': 'Previous page',
  'pagination.next': 'Next page',
  'pagination.page': 'Page {page}',
  'pagination.status': 'Page {page} of {pages}',
  'pagination.range': '{from}–{to} of {total}',
  'pagination.perPage': 'Rows per page',

  // Forms
  'form.network': "Couldn't reach the server. Check your connection and try again.",
  'form.server': "The server couldn't process the form ({status}).",

  // Data grid
  'grid.search': 'Search…',
  'grid.searchRows': 'Search rows',
  'grid.selectAll': 'Select all',
  'grid.selectRow': 'Select row',
  'grid.empty': 'No data to display',
  'grid.noResults': 'No results for “{query}”',
  'grid.loading': 'Loading…',
  'grid.yes': 'Yes',
  'grid.no': 'No',
  'grid.total': 'Total',
  'grid.subtotal': 'Subtotal',
  'grid.rows': { one: '{count} row', other: '{count} rows' },
  'grid.selected': '{count} of {total} selected',
  'grid.range': '{from}–{to} of {total}',
  'grid.page': 'Page {page} of {pages}',
  'grid.previousPage': 'Previous page',
  'grid.nextPage': 'Next page',
  'grid.resize': 'Resize {label} column',
  'grid.edit': 'Edit {label}',
  'grid.enterNumber': 'Enter a number',
  'grid.expand': 'Expand {label}',
  'grid.collapse': 'Collapse {label}'
};
