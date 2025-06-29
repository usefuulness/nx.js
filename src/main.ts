// src/main.ts
import { NX } from '@/core/application';

// Import all components
import '@/components/ui/button';
import '@/components/ui/card';
import '@/components/ui/toast';
import '@/components/ui/form';
import '@/components/ui/data';
import '@/components/layout/panel';
import '@/components/data/grid';

// Create a custom dashboard component
NX.define('dashboard', {
  observedAttributes: ['title'],
  
  initialize() {
    this.setState('stats', {
      users: 1234,
      projects: 42,
      revenue: 12345
    });
    
    // Simulate data loading
    setTimeout(() => {
      this.setState('stats', {
        users: 1267,
        projects: 44,
        revenue: 13456
      });
    }, 2000);
  },
  
  render() {
    const stats = this.getState('stats', {});
    const title = this.getProp('title', 'Dashboard');
    
    return `
      <div class="dashboard">
        <h2 class="dashboard-title">${title}</h2>
        
        <div class="stats-grid">
          <div class="stat-card">
            <h3>Total Users</h3>
            <p class="stat-value">${stats.users?.toLocaleString() || '...'}</p>
            <p class="stat-change positive">↑ 12% from last month</p>
          </div>
          
          <div class="stat-card">
            <h3>Active Projects</h3>
            <p class="stat-value">${stats.projects || '...'}</p>
            <p class="stat-change neutral">→ No change</p>
          </div>
          
          <div class="stat-card">
            <h3>Revenue</h3>
            <p class="stat-value">$${stats.revenue?.toLocaleString() || '...'}</p>
            <p class="stat-change positive">↑ 8% from last month</p>
          </div>
        </div>
        
        <div class="dashboard-content">
          <slot></slot>
        </div>
      </div>
    `;
  },
  
  styles() {
    return `
      .dashboard {
        padding: 2rem;
      }
      
      .dashboard-title {
        margin: 0 0 2rem 0;
        font-size: 2rem;
        font-weight: 700;
      }
      
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1.5rem;
        margin-bottom: 2rem;
      }
      
      .stat-card {
        background: var(--color-surface);
        padding: 1.5rem;
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-md);
        transition: transform 0.2s, box-shadow 0.2s;
      }
      
      .stat-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-lg);
      }
      
      .stat-card h3 {
        margin: 0 0 0.5rem 0;
        color: var(--color-text-secondary);
        font-size: 0.875rem;
        font-weight: 500;
      }
      
      .stat-value {
        margin: 0;
        font-size: 2rem;
        font-weight: 700;
        color: var(--color-text);
      }
      
      .stat-change {
        margin: 0.5rem 0 0;
        font-size: 0.875rem;
      }
      
      .stat-change.positive {
        color: var(--color-success);
      }
      
      .stat-change.negative {
        color: var(--color-error);
      }
      
      .stat-change.neutral {
        color: var(--color-text-secondary);
      }
      
      .dashboard-content {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }
    `;
  }
});

// Initialize the application
const app = NX.application({
  el: '#app',
  title: 'Nexaro Application',
  theme: 'light',
  
  layout: {
    type: 'border',
    items: [
      {
        xtype: 'panel',
        slot: 'north',
        title: 'Nexaro Framework',
        collapsible: false,
        closable: false,
        items: [
          {
            xtype: 'toolbar',
            items: [
              { xtype: 'button', text: 'Home', variant: 'ghost' },
              { xtype: 'button', text: 'Users', variant: 'ghost' },
              { xtype: 'button', text: 'Projects', variant: 'ghost' },
              { xtype: 'button', text: 'Settings', variant: 'ghost' },
              '->',  // spacer
              { 
                xtype: 'button', 
                text: '🌙', 
                variant: 'secondary',
                handler: () => {
                  const currentTheme = app.getTheme();
                  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                  app.setTheme(newTheme);
                }
              }
            ]
          }
        ]
      },
      {
        xtype: 'panel',
        slot: 'west',
        title: 'Navigation',
        width: 250,
        collapsible: true,
        resizable: true,
        items: [
          {
            xtype: 'tree',
            data: [
              {
                text: 'Dashboard',
                icon: 'dashboard',
                expanded: true,
                children: [
                  { text: 'Analytics', icon: 'chart' },
                  { text: 'Reports', icon: 'file' }
                ]
              },
              {
                text: 'Users',
                icon: 'users',
                children: [
                  { text: 'All Users', icon: 'list' },
                  { text: 'Roles', icon: 'key' }
                ]
              }
            ]
          }
        ]
      },
      {
        xtype: 'tabpanel',
        slot: 'center',
        items: [
          {
            title: 'Dashboard',
            items: [
              {
                xtype: 'dashboard',
                title: 'Welcome to Nexaro',
                items: [
                  {
                    xtype: 'panel',
                    title: 'User Management',
                    items: [
                      {
                        xtype: 'grid',
                        columns: [
                          { field: 'name', header: 'Name', flex: 1 },
                          { field: 'email', header: 'Email', width: 250 },
                          { field: 'role', header: 'Role', width: 150 },
                          { 
                            field: 'status', 
                            header: 'Status', 
                            width: 120,
                            renderer: (value) => {
                              const color = value === 'active' ? 'success' : 'warning';
                              return `<span class="badge badge-${color}">${value}</span>`;
                            }
                          }
                        ],
                        data: [
                          { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin', status: 'active' },
                          { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'User', status: 'active' },
                          { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'User', status: 'pending' },
                          { id: 4, name: 'Alice Brown', email: 'alice@example.com', role: 'Manager', status: 'active' },
                          { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', role: 'User', status: 'pending' }
                        ],
                        striped: true,
                        hoverable: true,
                        selectable: 'multiple',
                        checkboxSelection: true,
                        showToolbar: true,
                        showFooter: true
                      }
                    ]
                  },
                  {
                    xtype: 'panel',
                    title: 'Quick Actions',
                    items: [
                      {
                        xtype: 'form',
                        items: [
                          {
                            xtype: 'field',
                            label: 'Search Users',
                            items: [
                              {
                                xtype: 'textfield',
                                placeholder: 'Enter username or email...',
                                name: 'search'
                              }
                            ]
                          },
                          {
                            xtype: 'button',
                            text: 'Search',
                            variant: 'primary',
                            handler: () => {
                              app.notify('Search functionality coming soon!', 'info');
                            }
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            title: 'Analytics',
            items: [
              {
                xtype: 'panel',
                title: 'Analytics Dashboard',
                items: [
                  { xtype: 'text', text: 'Analytics content will go here...' }
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
      model: 'User',
      proxy: {
        type: 'rest',
        url: '/api/users'
      },
      autoLoad: false
    }
  },
  
  ready() {
    console.log('Application ready!');
    
    // Show welcome notification
    app.notify('Welcome to Nexaro Framework!', 'success');
    
    // Add global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + K for search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        app.modal({
          title: 'Quick Search',
          content: 'Search functionality coming soon!',
          buttons: [
            { text: 'Close', variant: 'secondary' }
          ]
        });
      }
    });
  }
});

// Launch the application
app.launch();

// Export for use in other modules
export { app };
