/**
 * Лёгкий переключаемый логгер для отладки (рассинхрон, подключение, плеер, парсинг).
 *
 * ВРЕМЕННО включён по умолчанию везде (включая production) — ловим баги. Вернуть к
 * `import.meta.env.DEV ?? false` после устранения. Точечно выключить можно в консоли страницы:
 *   __syncMateDebug(false)     // и перезагрузить страницу
 * либо вручную: localStorage["sync-mate:debug"] = "0".
 *
 * warn/error печатаются ВСЕГДА — это реальные проблемы, а не отладочный шум.
 *
 * Использование:
 *   const log = createLogger("WS");
 *   log.debug("→ send", msg.type, msg);
 */

const STORAGE_KEY = "sync-mate:debug";
const PREFIX = "[sync-mate]";

// localStorage есть в content-скрипте (контекст страницы), но не в service worker.
function readOverride(): boolean | null {
    try {
        if (typeof localStorage === "undefined") return null;
        const v = localStorage.getItem(STORAGE_KEY);
        if (v === "1" || v === "true") return true;
        if (v === "0" || v === "false") return false;
    } catch {
        // localStorage может быть недоступен (политика страницы) — молча игнорируем.
    }
    return null;
}

const enabledDefault: boolean = true; // временно: полный дебаг везде (вкл. production), до устранения багов
let enabled: boolean = readOverride() ?? enabledDefault;

export function setDebug(on: boolean): void {
    enabled = on;
    try {
        if (typeof localStorage !== "undefined") {
            localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
        }
    } catch {
        // ignore
    }
}

export function isDebugEnabled(): boolean {
    return enabled;
}

export interface Logger {
    debug(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
}

export function createLogger(namespace: string): Logger {
    const tag = `${PREFIX}[${namespace}]`;
    return {
        // debug/info → console.log/info, чтобы было видно на дефолтном уровне консоли.
        debug: (...a: unknown[]) => {
            if (enabled) console.log(tag, ...a);
        },
        info: (...a: unknown[]) => {
            if (enabled) console.info(tag, ...a);
        },
        warn: (...a: unknown[]) => console.warn(tag, ...a),
        error: (...a: unknown[]) => console.error(tag, ...a),
    };
}

declare global {
    interface Window {
        __syncMateDebug?: (on?: boolean) => void;
    }
}

// Глобальный тумблер для прода. В service worker window нет — пропускаем.
if (typeof window !== "undefined") {
    window.__syncMateDebug = (on = true) => setDebug(on);
}
