import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    base: './',
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        rollupOptions: {
            output: {
                manualChunks: {
                    'core': ['src/core/storage.js', 'src/core/renderer.js', 'src/core/events.js'],
                    'data': ['src/data/config.js', 'src/data/gameData.js'],
                    'systems': ['src/systems/battle.js', 'src/systems/equipment.js', 'src/systems/stage.js', 'src/systems/shop.js', 'src/systems/shelter.js', 'src/systems/collection.js'],
                    'ui': ['src/ui/ui.js', 'src/ui/modals.js']
                }
            }
        }
    },
    server: {
        port: 3000,
        open: true
    }
});
