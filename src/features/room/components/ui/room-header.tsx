import { useState } from "react";
import {
    ClipboardDocumentIcon,
    PencilSquareIcon,
    UsersIcon,
    CheckIcon,
} from "@heroicons/react/24/outline";

interface RoomHeaderProps {
    name: string;
    status: string;
    usersCount: number;
    link: string;
    onEditName: () => void;
}

const statusConfig: Record<
    string,
    { label: string; color: string; dot: string; pulse?: boolean }
> = {
    waiting: {
        label: "Ожидание",
        color: "bg-amber-500/15 text-amber-300 border-amber-500/25",
        dot: "bg-amber-400",
    },
    playing: {
        label: "Играет",
        color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
        dot: "bg-emerald-400",
        pulse: true,
    },
    paused: {
        label: "Пауза",
        color: "bg-blue-500/15 text-blue-300 border-blue-500/25",
        dot: "bg-blue-400",
    },
    pausing: {
        label: "Пауза",
        color: "bg-blue-500/15 text-blue-300 border-blue-500/25",
        dot: "bg-blue-400",
    },
};

export function RoomHeader({
    name,
    status,
    usersCount,
    link,
    onEditName,
}: RoomHeaderProps) {
    const [copied, setCopied] = useState(false);

    const statusInfo = statusConfig[status] ?? {
        label: status,
        color: "bg-white/8 text-white/50 border-white/10",
        dot: "bg-white/40",
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <header className="px-4 pt-4 pb-3.5 border-b border-white/6">
            <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 group">
                        <h2 className="text-sm font-bold text-white truncate leading-tight">
                            {name}
                        </h2>
                        <button
                            onClick={onEditName}
                            className="shrink-0 text-white/20 hover:text-violet-400 transition-colors opacity-0 group-hover:opacity-100"
                            title="Переименовать комнату"
                        >
                            <PencilSquareIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="flex items-center gap-2 mt-1.5">
                        <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border ${statusInfo.color}`}
                        >
                            <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusInfo.dot} ${statusInfo.pulse ? "animate-pulse" : ""}`}
                            />
                            {statusInfo.label}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-white/35">
                            <UsersIcon className="w-3 h-3 shrink-0" />
                            {usersCount}{" "}
                            {usersCount === 1
                                ? "участник"
                                : usersCount < 5
                                  ? "участника"
                                  : "участников"}
                        </span>
                    </div>
                </div>

                <button
                    onClick={handleCopy}
                    className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all ${
                        copied
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
                            : "bg-white/5 text-white/50 border-white/8 hover:bg-violet-500/12 hover:text-violet-300 hover:border-violet-500/25"
                    }`}
                    title="Скопировать ссылку-приглашение"
                >
                    {copied ? (
                        <>
                            <CheckIcon className="w-3.5 h-3.5" />
                            Готово
                        </>
                    ) : (
                        <>
                            <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                            Ссылка
                        </>
                    )}
                </button>
            </div>
        </header>
    );
}
