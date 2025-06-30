// Import all components to register them
import '@/components/abstracts/base';
import '@/components/abstracts/data';

// UI Components
import '@/components/ui/accordion';
import '@/components/ui/breadcrumb';
import '@/components/ui/button';
import '@/components/ui/card';
import '@/components/ui/drawer';
import '@/components/ui/loader';
import '@/components/ui/menu';
import '@/components/ui/menubar';
import '@/components/ui/modal';
import '@/components/ui/skeleton';
import '@/components/ui/spinner';
import '@/components/ui/tabpanel';
import '@/components/ui/toolbar';
import '@/components/ui/tree';

// Form Components
import '@/components/ui/form';
import '@/components/ui/form/textfield';
import '@/components/ui/form/select';

// Data Components
import '@/components/ui/data';

// Layout Components
import '@/layout/panel';
import '@/layout/viewport';

// Register core components with the registry
import { ComponentRegistry } from '@/core/registry';
ComponentRegistry.initialize();
