import { NXApplication } from './app';
import './components'; // Import all components

// Create and launch application
const app = NXApplication.create({
  el: '#app',
  title: 'Nexaro JS Example',
  theme: 'light',
  
  layout: {
    type: 'viewport',
    items: [
      {
        xtype: 'panel',
        region: 'north',
        height: '60px',
        items: [
          {
            xtype: 'toolbar',
            items: [
              {
                xtype: 'button',
                text: 'Menu',
                icon: 'menu',
                handler: () => {
                  const drawer = document.querySelector('nx-drawer');
                  (drawer as any)?.toggle();
                }
              },
              { xtype: 'spacer' },
              {
                xtype: 'button',
                text: 'Theme',
                icon: 'theme',
                handler: () => {
                  const current = app.getTheme();
                  app.setTheme(current === 'light' ? 'dark' : 'light');
                }
              }
            ]
          }
        ]
      },
      {
        xtype: 'panel',
        region: 'west',
        width: '250px',
        collapsible: true,
        title: 'Navigation',
        items: [
          {
            xtype: 'tree',
            data: [
              {
                text: 'Dashboard',
                icon: 'dashboard',
                expanded: true,
                children: [
                  { text: 'Overview', icon: 'chart' },
                  { text: 'Analytics', icon: 'analytics' },
                  { text: 'Reports', icon: 'report' }
                ]
              },
              {
                text: 'Components',
                icon: 'components',
                children: [
                  { text: 'Forms', icon: 'form' },
                  { text: 'Data', icon: 'table' },
                  { text: 'Layout', icon: 'layout' }
                ]
              }
            ]
          }
        ]
      },
      {
        xtype: 'panel',
        region: 'center',
        title: 'Main Content',
        items: [
          {
            xtype: 'tabpanel',
            items: [
              {
                title: 'Welcome',
                content: '<h1>Welcome to Nexaro JS</h1>'
              },
              {
                title: 'Data Grid',
                items: [
                  {
                    xtype: 'data-table',
                    store: 'users'
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  
  stores: {
    users: {
      data: [
        { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'User' },
        { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'User' }
      ]
    }
  },
  
  router: {
    mode: 'hash',
    routes: [
      {
        path: '/',
        component: 'home-view'
      },
      {
        path: '/about',
        component: 'about-view'
      }
    ]
  },
  
  ready: () => {
    console.log('Application ready!');
  }
});

// Launch the app
app.launch();

// Make app globally available for debugging
(window as any).app = app;
