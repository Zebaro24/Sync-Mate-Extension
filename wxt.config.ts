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
            // Каждое разрешение аннотировано: что/где/зачем — чтобы потом не
            // было вопросов и случайно не вернулось лишнее. activeTab НЕ нужен:
            // executeScript/insertCSS не используются, а единственный tabs.query
            // (use-room.ts) читает только tab.id — несенситивное поле, доступное
            // без разрешений; tabs.onRemoved разрешения тоже не требует.
            permissions: [
                // navigator.clipboard.writeText — копирование ссылки-приглашения.
                // Где: RoomCoordinator.ts (content-скрипт) + room-header.tsx
                // (popup). В content-скрипте без разрешения writeText требует
                // фокус/жест и падает — поэтому разрешение обязательно.
                "clipboardWrite",
                // background.ts → webRequest.onBeforeRequest (только main_frame).
                // Ловит навигацию на rezka *.html и на backend /rooms/{id}/redirect,
                // чтобы привязать состояние комнаты к вкладке ещё до загрузки
                // страницы. Только наблюдение — без webRequestBlocking.
                "webRequest",
                // Где: background.ts (storage.session 'rooms' + fallback local)
                // и shared/storage ('name', 'id:<roomId>'). Состояние комнат по
                // вкладкам и никнейм пользователя.
                "storage",
            ],
            host_permissions: [
                // Держим в синхроне с matches в content.ts (второй паттерн —
                // URL с query после .html). Нужно для инжекта content-скрипта и
                // чтобы webRequest вообще срабатывал на rezka.
                "https://rezka.ag/*.html",
                "https://rezka.ag/*.html?*",
                // REST-вызовы к бэкенду (roomApi/axios) из popup и content +
                // перехват redirect-навигации тем же webRequest'ом.
                `${backendUrl}/*`,
            ],
        };
    },
    zip: {
        // {{name}}-{{version}}-{{browser}}.zip (CI читает по этой маске)
        artifactTemplate: "{{name}}-{{version}}-{{browser}}.zip",
        sourcesTemplate: "{{name}}-{{version}}-sources.zip",
    },
    modules: ["@wxt-dev/module-react"],
    vite: (env) => ({
        plugins: [tailwindcss()],
        // В прод-сборке вырезаем логи и debugger; в dev оставляем.
        esbuild:
            env.mode === "production" ? { drop: ["console", "debugger"] } : {},
    }),
});
