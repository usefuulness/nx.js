/** `nx.js/locales/ar`: Arabic (right to left). Importing it adds the strings; set `lang="ar" dir="rtl"` (or `NX.i18n.setLanguage('ar')`). */
import { i18n } from '@/core/i18n';

i18n.extend('ar', {
  close: 'إغلاق', dismiss: 'تجاهل', clear: 'مسح', remove: 'إزالة', ok: 'حسنًا', cancel: 'إلغاء', confirm: 'تأكيد', loading: 'جارٍ التحميل',
  'breadcrumb.label': 'مسار التنقل', 'progress.label': 'التقدم', 'drawer.label': 'لوحة', 'dialog.label': 'نافذة حوار',
  'dialog.notice': 'تنبيه', 'dialog.confirmTitle': 'هل أنت متأكد؟',
  'datepicker.previousMonth': 'الشهر السابق', 'datepicker.nextMonth': 'الشهر التالي', 'datepicker.choose': 'اختر التاريخ',
  'combobox.empty': 'لا توجد نتائج.', 'combobox.show': 'عرض الخيارات', 'combobox.options': 'الخيارات',
  'select.placeholder': 'اختر…', 'menu.open': 'فتح القائمة',
  'command.empty': 'لم يتم العثور على نتائج.', 'command.placeholder': 'اكتب أمرًا أو ابحث…', 'command.commands': 'الأوامر',
  'region.toggle': 'تبديل المنطقة', 'panel.expand': 'توسيع اللوحة', 'panel.collapse': 'طي اللوحة', 'panel.close': 'إغلاق اللوحة',
  'pagination.label': 'ترقيم الصفحات', 'pagination.previous': 'الصفحة السابقة', 'pagination.next': 'الصفحة التالية', 'pagination.page': 'صفحة {page}',
  'pagination.status': 'صفحة {page} من {pages}', 'pagination.range': '{from}–{to} من {total}', 'pagination.perPage': 'عدد الصفوف في الصفحة',
  'upload.drop': 'أسقط الملفات هنا أو انقر للاختيار', 'upload.dropOne': 'أسقط ملفًا هنا أو انقر للاختيار', 'upload.release': 'حرّر للإضافة', 'upload.remove': 'إزالة {name}',
  'upload.required': 'اختر ملفًا واحدًا على الأقل', 'upload.tooLarge': '{name} أكبر من {max}', 'upload.wrongType': '{name} ليس نوع ملف مقبولًا',
  'upload.tooMany': { one: 'لم تتم إضافة {name}: يُسمح بملف واحد فقط', other: 'لم تتم إضافة {name}: يُسمح بـ {count} ملفات فقط' },
  'tags.placeholder': 'أضف وسمًا…', 'tags.remove': 'إزالة {tag}', 'tags.added': 'تمت إضافة {tag}', 'tags.removed': 'تمت إزالة {tag}', 'tags.duplicate': '{tag} مضاف بالفعل',
  'tags.max': { one: 'يُسمح بوسم واحد على الأكثر', other: 'يُسمح بـ {count} وسوم على الأكثر' }, 'tags.required': 'أضف وسمًا واحدًا على الأقل', 'tags.min': { one: 'أضف وسمًا واحدًا على الأقل', other: 'أضف {count} وسوم على الأقل' },
  'form.network': 'تعذّر الوصول إلى الخادم. تحقق من اتصالك وحاول مرة أخرى.',
  'form.server': 'تعذّر على الخادم معالجة النموذج ({status}).',
  'grid.search': 'بحث…', 'grid.searchRows': 'البحث في الصفوف', 'grid.selectAll': 'تحديد الكل', 'grid.selectRow': 'تحديد الصف',
  'grid.empty': 'لا توجد بيانات لعرضها', 'grid.noResults': 'لا توجد نتائج لـ «{query}»', 'grid.loading': 'جارٍ التحميل…',
  'grid.yes': 'نعم', 'grid.no': 'لا', 'grid.total': 'الإجمالي', 'grid.subtotal': 'المجموع الفرعي',
  // Arabic has six plural forms
  'grid.rows': { zero: 'لا صفوف', one: 'صف واحد', two: 'صفان', few: '{count} صفوف', many: '{count} صفًّا', other: '{count} صف' },
  'grid.selected': 'تم تحديد {count} من {total}', 'grid.range': '{from}–{to} من {total}', 'grid.page': 'صفحة {page} من {pages}',
  'grid.previousPage': 'الصفحة السابقة', 'grid.nextPage': 'الصفحة التالية',
  'grid.resize': 'تغيير عرض العمود {label}', 'grid.edit': 'تحرير {label}', 'grid.enterNumber': 'أدخل رقمًا',
  'grid.expand': 'توسيع {label}', 'grid.collapse': 'طي {label}'
});
