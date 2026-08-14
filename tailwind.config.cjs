const typography = require('@tailwindcss/typography');

/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        './index.html',
        './App.tsx',
        './components/**/*.{ts,tsx}',
        './features/**/*.{ts,tsx}',
        './hooks/**/*.{ts,tsx}',
        './services/**/*.{ts,tsx}',
        './workers/**/*.{ts,tsx}',
        './*.{ts,tsx}',
    ],
    theme: {
        extend: {
            screens: {
                xs: '420px',
            },
            fontFamily: {
                sans: [
                    'Inter',
                    'ui-sans-serif',
                    'system-ui',
                    '-apple-system',
                    'BlinkMacSystemFont',
                    '"Segoe UI"',
                    'sans-serif',
                ],
                mono: [
                    '"SFMono-Regular"',
                    'Consolas',
                    '"Liberation Mono"',
                    'Menlo',
                    'monospace',
                ],
                display: [
                    '"Segoe UI"',
                    'ui-sans-serif',
                    'system-ui',
                    'sans-serif',
                ],
            },
            colors: {
                brand: {
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    500: '#0ea5e9',
                    600: '#0284c7',
                    900: '#0c4a6e',
                },
            },
            boxShadow: {
                soft: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
                float: '0 10px 40px -10px rgba(0, 0, 0, 0.08)',
            },
            animation: {
                'fade-in': 'fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'slide-up': 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                breathe: 'breathe 6s ease-in-out infinite',
                music: 'music 1s ease-in-out infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                breathe: {
                    '0%, 100%': { transform: 'scale(1)', opacity: '0.3' },
                    '50%': { transform: 'scale(1.05)', opacity: '0.5' },
                },
                music: {
                    '0%, 100%': { height: '20%' },
                    '50%': { height: '100%' },
                },
            },
        },
    },
    plugins: [typography],
};
