import { createApp } from 'vue'
import App from './App.vue'
import router from './router/router'

// Chart.js
import './plugins/chartjs'

// Vuetify
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import '@mdi/font/css/materialdesignicons.css'

// Create Vuetify instance with improved theme support
const vuetify = createVuetify({
  components,
  directives,
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi,
    },
  },
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        dark: false,
        colors: {
          primary: '#1976d2',
          secondary: '#2ecc71',
          accent: '#9c27b0',
          error: '#e74c3c',
          warning: '#f39c12',
          info: '#3498db',
          success: '#2ecc71',
          background: '#f5f7fa',
          surface: '#ffffff',
          'on-surface': '#424242',
          'on-background': '#333333',
        },
      },
      dark: {
        dark: true,
        colors: {
          primary: '#64b5f6', // Lighter blue for dark theme
          secondary: '#2ecc71',
          accent: '#ce93d8', // Lighter purple for dark theme
          error: '#e57373', // Lighter red for dark theme
          warning: '#ffb74d', // Lighter orange for dark theme
          info: '#4fc3f7', // Lighter blue for dark theme
          success: '#81c784', // Lighter green for dark theme
          background: '#121212', 
          surface: '#1e1e1e',
          'on-surface': '#eeeeee',
          'on-background': '#ffffff',
        },
      },
    },
    // Enable theme variations
    variations: {
      colors: ['primary', 'secondary', 'accent'],
      lighten: 5,
      darken: 5,
    },
  },
  // Add default properties for components 
  defaults: {
    VCard: {
      elevation: 2,
      rounded: 'lg',
    },
    VBtn: {
      variant: 'elevated',
      rounded: 'lg',
    },
    VTextField: {
      variant: 'outlined',
      density: 'comfortable',
    },
    VSelect: {
      variant: 'outlined',
      density: 'comfortable',
    },
  },
})

// Create and mount the app
const app = createApp(App)
app.use(router)
app.use(vuetify)

// Add global error handler for API requests
app.config.errorHandler = (err, vm, info) => {

}

// Listen for theme changes
window.addEventListener('themeChange', (event) => {
  const darkMode = event.detail.darkMode;
  try {
    // Theme change logic centralized here
    applyTheme(darkMode);
  } catch (error) {
  }
});

// Apply theme based on dark mode setting
function applyTheme(darkMode) {
  // Update Vuetify theme
  vuetify.theme.global.name.value = darkMode ? 'dark' : 'light';
  
  // Store in localStorage
  localStorage.setItem('darkMode', darkMode ? 'true' : 'false');
  
  // Apply to document
  document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  
  // Add or remove dark class from body for any custom CSS
  if (darkMode) {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }
}

// Check local storage for theme preference on startup
const initializeTheme = () => {
  try {
    const storedTheme = localStorage.getItem('darkMode');
    const prefersDarkMode = window.matchMedia && 
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Use stored preference or system preference
    const useDarkMode = storedTheme === 'true' || 
      (storedTheme === null && prefersDarkMode);
    
    applyTheme(useDarkMode);
    
    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (e) => {
        // Only apply system preference if no user preference is stored
        if (localStorage.getItem('darkMode') === null) {
          applyTheme(e.matches);
        }
      });
  } catch (error) {
  }
};

// Initialize theme from localStorage or system preference
initializeTheme();


// Add global CSS variables for consistent theming
const injectGlobalStyles = () => {
  const style = document.createElement('style');
  style.textContent = `
    :root {
      --primary: var(--v-theme-primary);
      --secondary: var(--v-theme-secondary);
      --accent: var(--v-theme-accent);
      --error: var(--v-theme-error);
      --warning: var(--v-theme-warning);
      --info: var(--v-theme-info);
      --success: var(--v-theme-success);
      --background: var(--v-theme-background);
      --surface: var(--v-theme-surface);
      --on-surface: var(--v-theme-on-surface);
      --on-background: var(--v-theme-on-background);
      
      --card-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      --transition-speed: 0.3s;
    }
    
    body.dark-theme {
      --card-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    }
    
    /* Global transition for theme switching */
    *, *::before, *::after {
      transition: background-color var(--transition-speed) ease,
                  color var(--transition-speed) ease,
                  border-color var(--transition-speed) ease,
                  box-shadow var(--transition-speed) ease;
    }
  `;
  document.head.appendChild(style);
};

// Inject the global styles
injectGlobalStyles();

// Mount the app
app.mount('#app')