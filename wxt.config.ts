import {defineConfig} from "wxt";

// noinspection JSUnusedGlobalSymbols
export default defineConfig({
    manifest: {
        name: "Sync-Mate",
        web_accessible_resources: [
            {
                "resources": ["icon/48.png"],
                "matches": ["<all_urls>"]
            }
        ],
        permissions: [
            "webRequest",
            "storage",
            "activeTab"
        ],
    },
    zip: {
        artifactTemplate: 'Sync-Mate-Extension.zip',
    }
});
