/** `nx.js/locales/es`: Spanish. Importing it adds the strings; set `lang="es"` to use them. */
import { i18n } from '@/core/i18n';

i18n.extend('es', {
  close: 'Cerrar', dismiss: 'Descartar', clear: 'Borrar', remove: 'Quitar', ok: 'Aceptar', cancel: 'Cancelar', confirm: 'Confirmar', loading: 'Cargando',
  'breadcrumb.label': 'Ruta de navegación', 'chart.label': 'Gráfico', 'chart.value': 'Valor', 'chart.empty': 'No hay datos que mostrar', 'progress.label': 'Progreso', 'drawer.label': 'Panel', 'dialog.label': 'Diálogo',
  'dialog.notice': 'Aviso', 'dialog.confirmTitle': '¿Está seguro?',
  'datepicker.previousMonth': 'Mes anterior', 'datepicker.nextMonth': 'Mes siguiente', 'datepicker.choose': 'Elegir fecha',
  'combobox.empty': 'Sin resultados.', 'combobox.show': 'Mostrar opciones', 'combobox.options': 'Opciones',
  'select.placeholder': 'Seleccionar…', 'menu.open': 'Abrir menú',
  'command.empty': 'No se encontraron resultados.', 'command.placeholder': 'Escriba un comando o busque…', 'command.commands': 'Comandos',
  'region.toggle': 'Alternar región', 'panel.expand': 'Expandir panel', 'panel.collapse': 'Contraer panel', 'panel.close': 'Cerrar panel',
  'pagination.label': 'Paginación', 'pagination.previous': 'Página anterior', 'pagination.next': 'Página siguiente', 'pagination.page': 'Página {page}',
  'pagination.status': 'Página {page} de {pages}', 'pagination.range': '{from}–{to} de {total}', 'pagination.perPage': 'Filas por página',
  'upload.drop': 'Suelte los archivos aquí o haga clic para elegir', 'upload.dropOne': 'Suelte un archivo aquí o haga clic para elegir', 'upload.release': 'Suelte para añadir', 'upload.remove': 'Quitar {name}',
  'upload.required': 'Elija al menos un archivo', 'upload.tooLarge': '{name} supera {max}', 'upload.wrongType': '{name} no es un tipo de archivo admitido',
  'upload.tooMany': { one: '{name} no se añadió: solo se permite {count} archivo', other: '{name} no se añadió: solo se permiten {count} archivos' },
  'tags.placeholder': 'Añadir etiqueta…', 'tags.remove': 'Quitar {tag}', 'tags.added': 'Añadida {tag}', 'tags.removed': 'Quitada {tag}', 'tags.duplicate': '{tag} ya está añadida',
  'tags.max': { one: 'Máximo {count} etiqueta', other: 'Máximo {count} etiquetas' }, 'tags.required': 'Añada al menos una etiqueta', 'tags.min': { one: 'Añada al menos {count} etiqueta', other: 'Añada al menos {count} etiquetas' },
  'splitter.resize': 'Cambiar el tamaño de los paneles',
  'chat.label': 'Conversación', 'chat.inputLabel': 'Escribir un mensaje', 'chat.placeholder': 'Mensaje…', 'chat.send': 'Enviar mensaje', 'chat.stop': 'Detener la generación', 'chat.you': 'Tú', 'chat.assistant': 'Asistente', 'chat.copy': 'Copiar', 'chat.copied': 'Copiado', 'chat.copyCode': 'Copiar código', 'chat.regenerate': 'Regenerar respuesta', 'chat.retry': 'Intentar de nuevo', 'chat.error': 'Algo salió mal', 'chat.stopped': 'Detenido', 'chat.responding': 'El asistente está respondiendo', 'chat.complete': 'Respuesta completa', 'chat.latest': 'Ir al último', 'chat.empty': 'Empiece una conversación',
  'stepper.label': 'Progreso', 'stepper.step': 'Paso {n} de {total}', 'stepper.complete': 'completado', 'stepper.current': 'paso actual', 'stepper.upcoming': 'sin empezar', 'stepper.error': 'requiere atención',
  'form.network': 'No se pudo conectar con el servidor. Compruebe su conexión e inténtelo de nuevo.',
  'form.server': 'El servidor no pudo procesar el formulario ({status}).',
  'grid.search': 'Buscar…', 'grid.searchRows': 'Buscar filas', 'grid.selectAll': 'Seleccionar todo', 'grid.selectRow': 'Seleccionar fila',
  'grid.empty': 'No hay datos que mostrar', 'grid.noResults': 'Sin resultados para «{query}»', 'grid.loading': 'Cargando…',
  'grid.yes': 'Sí', 'grid.no': 'No', 'grid.total': 'Total', 'grid.subtotal': 'Subtotal',
  'grid.rows': { one: '{count} fila', other: '{count} filas' },
  'grid.selected': '{count} de {total} seleccionadas', 'grid.range': '{from}–{to} de {total}', 'grid.page': 'Página {page} de {pages}',
  'grid.previousPage': 'Página anterior', 'grid.nextPage': 'Página siguiente',
  'grid.resize': 'Cambiar el ancho de la columna {label}', 'grid.edit': 'Editar {label}', 'grid.enterNumber': 'Introduzca un número',
  'grid.expand': 'Expandir {label}', 'grid.collapse': 'Contraer {label}'
});
