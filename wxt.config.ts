import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// noinspection JSUnusedGlobalSymbols
export default defineConfig({
    srcDir: path.resolve("src"),
    imports: false,
    entrypointsDir: "entrypoints",
    webExt: {
        startUrls: [
            "https://rezka.ag/films/action/76221-supermen-2025-latest.html",
        ],
    },
    manifest: () => ({
        name: "Sync-Mate",
        web_accessible_resources: [
            {
                resources: ["icon/48.png"],
                matches: ["<all_urls>"],
            },
        ],
        permissions: ["clipboardWrite", "webRequest", "storage", "activeTab"],
        host_permissions: [
            "https://rezka.ag/*.html",
            import.meta.env.WXT_API_URL + "/*",
        ],
    }),
    zip: {
        artifactTemplate: "Sync-Mate-Extension.zip",
    },
    modules: ["@wxt-dev/module-react"],
    vite: () => ({
        plugins: [tailwindcss()],
    }),
});
