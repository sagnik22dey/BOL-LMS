/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#0058bc",
        "primary-container": "#adc6ff",
        "on-primary-fixed": "#00418f",
        "on-primary-fixed-variant": "#003a7d",
        "primary-fixed": "#e5edff",
        "primary-fixed-dim": "#b3c6f4",
        "on-primary": "#ffffff",
        
        "tertiary": "#4b5e86",
        "tertiary-container": "#33466c",
        "tertiary-fixed": "#b3c6f4",
        "tertiary-fixed-dim": "#83a2eb",
        "on-tertiary-fixed": "#1a2c56",
        "on-tertiary-fixed-variant": "#33466c",
        "on-tertiary-container": "#ccdfff",
        
        
        "surface": "#f8f9fa",
        "surface-bright": "#f8f9fa",
        "surface-dim": "#e1e3e4",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f3f4f5",
        "surface-container": "#edeeef",
        "surface-container-high": "#e7e8e9",
        "surface-container-highest": "#e1e3e4",
        "surface-variant": "#e1e3e4",
        "surface-tint": "#0058bc",
        
        "on-surface": "#191c1d",
        "on-surface-variant": "#424753",
        "inverse-surface": "#2e3132",
        "inverse-on-surface": "#eff1f2",
        
        "outline": "#727784",
        "outline-variant": "rgba(114, 119, 132, 0.15)",
        
        "error": "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
        
        "background": "#f8f9fa",
        "on-background": "#191c1d",
        
        "secondary": "#4b5e86",
        "on-secondary": "#ffffff",
        "secondary-container": "#e2e2e5",
        "secondary-fixed": "#e2e2e5",
        "secondary-fixed-dim": "#c6c6c9",
      },
      fontFamily: {
        "headline": ["Manrope", "sans-serif"],
        "body": ["Inter", "sans-serif"],
        "label": ["Inter", "sans-serif"]
      },

    },
  },
  plugins: [],
}
