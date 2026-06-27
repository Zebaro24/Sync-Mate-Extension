import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    FilmIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon,
    UserCircleIcon,
    PencilIcon,
} from "@heroicons/react/24/outline";
import { useRoom } from "../../hooks/use-room";
import { RoomHeader } from "../ui/room-header";
import { UserList } from "../ui/user-list";
import { RoomSkeleton } from "../skeletons/room-skeleton";
import { EditModal } from "../ui/edit-modal";
import { roomApi } from "../../api/room-api";
import { getItem, setItem } from "@/shared/storage";

function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center">
                <FilmIcon className="w-7 h-7 text-white/20" />
            </div>
            <p className="text-white/35 text-sm leading-relaxed">{message}</p>
        </div>
    );
}

function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
    const isNoRoom = error.message === "NO_ROOM";
    const isNoTab = error.message === "NO_TAB";

    const message = isNoTab
        ? "Не удалось определить активную вкладку."
        : isNoRoom
          ? "Вы не в комнате. Перейдите на Rezka и создайте или присоединитесь к комнате."
          : `Ошибка: ${error.message}`;

    return (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-4">
            <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${
                    isNoRoom
                        ? "bg-violet-500/10 border-violet-500/20"
                        : "bg-rose-500/10 border-rose-500/20"
                }`}
            >
                <ExclamationTriangleIcon
                    className={`w-7 h-7 ${isNoRoom ? "text-violet-400/50" : "text-rose-400/50"}`}
                />
            </div>
            <p className="text-white/35 text-sm leading-relaxed max-w-[260px]">
                {message}
            </p>
            {!isNoRoom && !isNoTab && (
                <button
                    onClick={onRetry}
                    className="flex items-center gap-2 px-4 py-2 text-xs rounded-xl bg-white/5 hover:bg-white/8 text-white/50 border border-white/8 transition-colors"
                >
                    <ArrowPathIcon className="w-3.5 h-3.5" />
                    Повторить
                </button>
            )}
        </div>
    );
}

export function RoomContainer() {
    const queryClient = useQueryClient();
    const { data: room, isLoading, error, refetch } = useRoom();

    const [nickname, setNickname] = useState<string>("");
    const [editingRoomName, setEditingRoomName] = useState(false);
    const [editingNickname, setEditingNickname] = useState(false);

    useEffect(() => {
        getItem("name").then((n) => setNickname((n as string) ?? ""));
    }, []);

    const updateRoomName = useMutation({
        mutationFn: (name: string) => roomApi.update(room!.id, { name }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["room"] });
            setEditingRoomName(false);
        },
    });

    const updateNickname = useMutation({
        mutationFn: async (name: string) => {
            await setItem("name", name);
            return name;
        },
        onSuccess: (name) => {
            setNickname(name);
            setEditingNickname(false);
        },
    });

    const myUser = room?.users.find((u) => u.isMe);

    if (isLoading) return <RoomSkeleton />;
    // Полноэкранная ошибка — только без данных; сбой фонового poll не должен
    // выбрасывать из валидной комнаты.
    if (error && !room)
        return <ErrorState error={error} onRetry={() => refetch()} />;
    if (!room) return <EmptyState message="Комната не найдена." />;

    return (
        <>
            <RoomHeader
                name={room.name}
                status={room.status}
                usersCount={room.users.length}
                link={room.link}
                onEditName={() => setEditingRoomName(true)}
            />

            {/* Сбой фонового обновления при наличии кэш-данных */}
            {error && (
                <div className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] text-amber-400/60 bg-amber-500/5 border-b border-amber-500/10">
                    <ExclamationTriangleIcon className="w-3 h-3 shrink-0" />
                    <span>Не удалось обновить данные</span>
                </div>
            )}

            <UserList
                users={room.users}
                onEditNickname={() => setEditingNickname(true)}
            />

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/5 bg-white/2">
                <div className="flex items-center gap-1.5 text-[11px] text-white/30 min-w-0">
                    <UserCircleIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{nickname || "Guest"}</span>
                </div>
                <button
                    onClick={() => setEditingNickname(true)}
                    className="shrink-0 flex items-center gap-1 text-[10px] text-white/25 hover:text-violet-400 transition-colors"
                >
                    <PencilIcon className="w-3 h-3" />
                    Сменить ник
                </button>
            </div>

            {editingRoomName && (
                <EditModal
                    title="Название комнаты"
                    initialValue={room.name}
                    placeholder="Введите название..."
                    isLoading={updateRoomName.isPending}
                    onSave={(name) => updateRoomName.mutate(name)}
                    onClose={() => setEditingRoomName(false)}
                />
            )}

            {editingNickname && (
                <EditModal
                    title="Ваш никнейм"
                    initialValue={myUser?.name ?? nickname}
                    placeholder="Введите никнейм..."
                    note="Новый ник применится при следующем подключении (перезагрузите страницу или подключитесь к комнате заново)."
                    isLoading={updateNickname.isPending}
                    onSave={(name) => updateNickname.mutate(name)}
                    onClose={() => setEditingNickname(false)}
                />
            )}
        </>
    );
}
