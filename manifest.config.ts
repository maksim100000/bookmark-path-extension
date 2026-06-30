import {defineManifest} from '@crxjs/vite-plugin'
import pkg from './package.json'


export default defineManifest({
    manifest_version: 3,
    name: "Bookmark Search & Path: Simple Viewer",
    version: pkg.version,
    description: "Plain bookmark search extension. Preview and open folders, quickly find and navigate to browser links, displaying full folder paths.\n\nSource code on GitHub: https://github.com/maksim100000/bookmark-path-extension",
    icons: {
        16: '16-bm.png',
        32: '32-bm.png',
        48: '48-bm.png',
        128: '128-bm.png',
    },
    action: {
        default_popup:'src/popup/index.html',
        default_icon: {
            48: '48-bm.png',
        },
        default_title: "Open popup"
    },
    background:{
        service_worker: "src/background/main.ts"
    },
    permissions: [
        "bookmarks",
    ],
    
})
