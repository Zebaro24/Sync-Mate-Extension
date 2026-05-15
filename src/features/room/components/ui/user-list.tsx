import { UsersIcon } from "@heroicons/react/24/outline";
import { UserCard } from "./user-card";
import type { UserViewModel } from "../../types/view-models";

interface UserListProps {
    users: UserViewModel[];
    onEditNickname: () => void;
}

export function UserList({ users, onEditNickname }: UserListProps) {
    if (users.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-white/20 gap-2">
                <UsersIcon className="w-8 h-8" />
                <span className="text-xs">Нет участников</span>
            </div>
        );
    }

    return (
        <ul className="divide-y divide-white/5 max-h-[55vh] overflow-y-auto overflow-x-hidden">
            {users.map((user) => (
                <li key={user.id}>
                    <UserCard
                        user={user}
                        onEditNickname={user.isMe ? onEditNickname : undefined}
                    />
                </li>
            ))}
        </ul>
    );
}
