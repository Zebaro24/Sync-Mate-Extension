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
    manifest: () => {
        // Backend URL может быть с trailing / в env — нормализуем.
        const backendUrl = (
            (import.meta.env.WXT_BACKEND_URL as string) || ""
        ).replace(/\/+$/, "");
        return {
            name: "Sync-Mate",
            web_accessible_resources: [
                {
                    resources: ["icon/48.png"],
                    matches: ["<all_urls>"],
                },
            ],
            permissions: [
                "clipboardWrite",
                "webRequest",
                "storage",
                "activeTab",
            ],
            host_permissions: ["https://rezka.ag/*.html", `${backendUrl}/*`],
        };
    },
    zip: {
        // {{name}}-{{version}}-{{browser}}.zip (CI читает по этой маске)
        artifactTemplate: "{{name}}-{{version}}-{{browser}}.zip",
        sourcesTemplate: "{{name}}-{{version}}-sources.zip",
    },
    modules: ["@wxt-dev/module-react"],
    vite: () => ({
        plugins: [tailwindcss()],
    }),
});
