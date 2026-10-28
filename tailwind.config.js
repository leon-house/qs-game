/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './index.html',
        './src/**/*.{js,html}',
        './dist-release/index.html',
        './dist-release/src/**/*.{js,html}',
    ],
    theme: {
        extend: {
            colors: {
                'bg-dark': '#0d0d0d',
                'bg-panel': 'rgba(30, 30, 30, 0.95)',
                'bg-card': 'rgba(50, 50, 50, 0.9)',
                'text-primary': '#e8e8e8',
                'text-secondary': '#888888',
                'text-muted': '#555555',
                'brand-gold': '#ffd700',
                'brand-diamond': '#00bfff',
                'brand-red': '#ff4444',
                'brand-green': '#4ade80',
                'brand-purple': '#a855f7',
                'brand-orange': '#fb923c',
                'player-hp': '#4ade80',
                'boss-hp': '#ff4757',
            },
            fontFamily: {
                'sans': ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
                'mono': ['Courier New', 'Consolas', 'monospace'],
            },
        },
    },
    plugins: [],
};
