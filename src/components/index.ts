// Importing this module defines every <nx-*> element.

// Layout
import '@/layout/container';
import '@/layout/panel';
import '@/layout/viewport';

// UI
import '@/components/ui/accordion';
import '@/components/ui/badge';
import '@/components/ui/breadcrumb';
import '@/components/ui/button';
import '@/components/ui/card';
import '@/components/ui/drawer';
import '@/components/ui/loader';
import '@/components/ui/menu';
import '@/components/ui/menubar';
import '@/components/ui/modal';
import '@/components/ui/progress';
import '@/components/ui/skeleton';
import '@/components/ui/spinner';
import '@/components/ui/tabpanel';
import '@/components/ui/toast';
import '@/components/ui/toolbar';
import '@/components/ui/tree';

// Forms
import '@/components/ui/form';
import '@/components/ui/form/textfield';
import '@/components/ui/form/select';
import '@/components/ui/form/checkbox';

// Data
import '@/data/grid';

import { ComponentRegistry } from '@/core/registry';
ComponentRegistry.initialize();
