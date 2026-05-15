import {
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    ArrowDownTrayIcon,
    PencilIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "@/shared/components/ui/badge";
import type { UserViewModel } from "../../types/view-models";

const AVATAR_GRADIENTS = [
    "from-violet-500 to-purple-700",
    "from-blue-500 to-cyan-700",
    "from-emerald-500 to-teal-700",
    "from-amber-500 to-orange-700",
    "from-rose-500 to-pink-700",
    "from-indigo-500 to-blue-700",
];

function getAvatarGradient(name: string): string {
    const idx =
        name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) %
        AVATAR_GRADIENTS.length;
    return AVATAR_GRADIENTS[idx];
}

interface UserCardProps {
    user: UserViewModel;
    onEditNickname?: () => void;
}

export function UserCard({ user, onEditNickname }: UserCardProps) {
    const gradient = getAvatarGradient(user.name);

    return (
        <div
            className={`flex items-center gap-3 px-4 py-3 transition-colors group ${
                user.isMe
                    ? "bg-violet-500/8 border-l-2 border-violet-400/50"
                    : "border-l-2 border-transparent hover:bg-white/3"
            }`}
        >
            {/* Avatar */}
            <div
                className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-xs font-bold bg-gradient-to-br ${gradient} text-white shadow-md`}
            >
                {user.name.slice(0, 2).toUpperCase()}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                    <span className="font-semibold text-sm text-white truncate">
                        {user.name}
                    </span>
                    {user.isMe && (
                        <span className="shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                            вы
                        </span>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {user.episode && (
                        <Badge variant="indigo">{user.episode}</Badge>
                    )}
                    {user.translator && (
                        <Badge variant="blue">{user.translator}</Badge>
                    )}
                    <span className="flex items-center gap-1 text-[10px] text-white/30">
                        <ClockIcon className="w-2.5 h-2.5 shrink-0" />
                        {user.currentTime}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-white/30">
                        <ArrowDownTrayIcon className="w-2.5 h-2.5 shrink-0" />
                        {user.downloadTime}
                    </span>
                </div>
            </div>

            {/* Right side */}
            <div className="shrink-0 flex items-center gap-1.5">
                {user.isMe && onEditNickname && (
                    <button
                        onClick={onEditNickname}
                        className="text-white/15 hover:text-violet-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Изменить никнейм"
                    >
                        <PencilIcon className="w-3.5 h-3.5" />
                    </button>
                )}
                {user.synchronized ? (
                    <CheckCircleIcon
                        className="w-5 h-5 text-emerald-400"
                        title="Синхронизирован"
                    />
                ) : (
                    <XCircleIcon
                        className="w-5 h-5 text-rose-400/60"
                        title="Не синхронизирован"
                    />
                )}
            </div>
        </div>
    );
}
