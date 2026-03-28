import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0058bc',
      light: '#adc6ff',
      dark: '#00418f',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#4b5e86',
      light: '#b3c6f4',
      dark: '#33466c',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f8f9fa',
      paper: '#ffffff',
    },
    text: {
      primary: '#191c1d',
      secondary: '#424753',
    },
    error: {
      main: '#ba1a1a',
    },
    divider: 'rgba(114, 119, 132, 0.15)',
    surface: {
      lowest: '#ffffff',
      low: '#f3f4f5',
      base: '#f8f9fa',
      container: '#edeeef',
      high: '#e7e8e9',
      highest: '#e1e3e4',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontFamily: '"Manrope", sans-serif', fontWeight: 800, letterSpacing: '-2px' },
    h2: { fontFamily: '"Manrope", sans-serif', fontWeight: 800, letterSpacing: '-1.5px' },
    h3: { fontFamily: '"Manrope", sans-serif', fontWeight: 700, letterSpacing: '-1px' },
    h4: { fontFamily: '"Manrope", sans-serif', fontWeight: 700, letterSpacing: '-0.5px' },
    h5: { fontFamily: '"Manrope", sans-serif', fontWeight: 600 },
    h6: { fontFamily: '"Manrope", sans-serif', fontWeight: 600 },
    subtitle1: { fontFamily: '"Inter", sans-serif', fontWeight: 500, fontSize: '1rem', lineHeight: 1.6 },
    subtitle2: { fontFamily: '"Inter", sans-serif', fontWeight: 600, fontSize: '0.875rem' },
    body1: { fontFamily: '"Inter", sans-serif', lineHeight: 1.6 },
    body2: { fontFamily: '"Inter", sans-serif', lineHeight: 1.5 },
    button: { textTransform: 'none', fontFamily: '"Inter", sans-serif', fontWeight: 600 },
    caption: { fontFamily: '"Inter", sans-serif', fontSize: '0.75rem', letterSpacing: '0.03em' },
    overline: { fontFamily: '"Inter", sans-serif', fontWeight: 600, letterSpacing: '0.08em', fontSize: '0.7rem' },
  },
  shape: {
    borderRadius: 12,
  },
  shadows: [
    'none',
    '0 2px 8px rgba(25, 28, 29, 0.04)',
    '0 4px 16px rgba(25, 28, 29, 0.06)',
    '0 8px 24px rgba(25, 28, 29, 0.08)',
    '0 12px 32px rgba(25, 28, 29, 0.10)',
    '0 16px 48px rgba(25, 28, 29, 0.12)',
    '0 20px 64px rgba(25, 28, 29, 0.14)',
    '0 24px 80px rgba(25, 28, 29, 0.16)',
    '0 28px 96px rgba(25, 28, 29, 0.18)',
    '0 32px 112px rgba(25, 28, 29, 0.20)',
    '0 36px 128px rgba(25, 28, 29, 0.22)',
    '0 40px 144px rgba(25, 28, 29, 0.24)',
    '0 44px 160px rgba(25, 28, 29, 0.24)',
    '0 48px 176px rgba(25, 28, 29, 0.24)',
    '0 52px 192px rgba(25, 28, 29, 0.24)',
    '0 56px 208px rgba(25, 28, 29, 0.24)',
    '0 60px 224px rgba(25, 28, 29, 0.24)',
    '0 64px 240px rgba(25, 28, 29, 0.24)',
    '0 68px 256px rgba(25, 28, 29, 0.24)',
    '0 72px 272px rgba(25, 28, 29, 0.24)',
    '0 76px 288px rgba(25, 28, 29, 0.24)',
    '0 80px 304px rgba(25, 28, 29, 0.24)',
    '0 84px 320px rgba(25, 28, 29, 0.24)',
    '0 88px 336px rgba(25, 28, 29, 0.24)',
    '0 92px 352px rgba(25, 28, 29, 0.24)',
  ],
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 24,
          boxShadow: 'none',
          fontWeight: 600,
          '&:hover': {
            boxShadow: '0 4px 16px rgba(0, 88, 188, 0.2)',
          },
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #00418f 0%, #0058bc 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #003a7d 0%, #004fa8 100%)',
          },
        },
        outlinedPrimary: {
          borderColor: 'rgba(0, 88, 188, 0.3)',
          '&:hover': {
            borderColor: '#0058bc',
            backgroundColor: 'rgba(0, 88, 188, 0.04)',
          },
        },
        sizeLarge: {
          padding: '12px 28px',
          fontSize: '1rem',
        },
        sizeMedium: {
          padding: '9px 20px',
        },
        sizeSmall: {
          padding: '6px 14px',
          fontSize: '0.8125rem',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        rounded: {
          borderRadius: 16,
        },
        elevation1: {
          boxShadow: '0 2px 8px rgba(25, 28, 29, 0.04)',
        },
        elevation2: {
          boxShadow: '0 4px 16px rgba(25, 28, 29, 0.06)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 2px 8px rgba(25, 28, 29, 0.04)',
          backgroundImage: 'none',
          border: 'none',
          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
          '&:hover': {
            boxShadow: '0 8px 24px rgba(25, 28, 29, 0.08)',
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            backgroundColor: '#f3f4f5',
            '& fieldset': {
              borderColor: 'transparent',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(0, 88, 188, 0.3)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#0058bc',
              borderWidth: 1,
            },
            '&.Mui-focused': {
              backgroundColor: '#ffffff',
            },
          },
          '& .MuiInputLabel-root': {
            color: '#424753',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
          fontSize: '0.75rem',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontFamily: '"Inter", sans-serif',
          fontSize: '0.9rem',
          minHeight: 48,
          padding: '8px 16px',
          '&.Mui-selected': {
            color: '#0058bc',
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: '#0058bc',
          height: 2,
          borderRadius: '2px 2px 0 0',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          height: 8,
          backgroundColor: '#e1e3e4',
        },
        bar: {
          borderRadius: 8,
          background: 'linear-gradient(90deg, #00418f 0%, #0058bc 100%)',
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          backgroundColor: '#0058bc',
          color: '#ffffff',
          fontFamily: '"Manrope", sans-serif',
          fontWeight: 700,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          '&.Mui-selected': {
            backgroundColor: '#EEF4FF',
            color: '#0058bc',
            '& .MuiListItemIcon-root': {
              color: '#0058bc',
            },
            '&:hover': {
              backgroundColor: '#E5EDFF',
            },
          },
          '&:hover': {
            backgroundColor: '#f3f4f5',
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(114, 119, 132, 0.12)',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            backgroundColor: '#f3f4f5',
            fontWeight: 600,
            fontFamily: '"Inter", sans-serif',
            fontSize: '0.8rem',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: '#424753',
            borderBottom: 'none',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(114, 119, 132, 0.08)',
          padding: '16px',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: '#f8f9fa',
          },
          '&:last-child td': {
            borderBottom: 'none',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          boxShadow: '0 24px 80px rgba(25, 28, 29, 0.16)',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#191c1d',
          borderRadius: 8,
          fontSize: '0.75rem',
          fontFamily: '"Inter", sans-serif',
        },
      },
    },
    MuiSnackbar: {
      styleOverrides: {
        root: {
          '& .MuiAlert-root': {
            borderRadius: 12,
          },
        },
      },
    },
  },
});

export default theme;
