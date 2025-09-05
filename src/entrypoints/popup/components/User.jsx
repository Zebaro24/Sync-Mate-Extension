export function User({ user }) {
    return (
        <div className="flex items-center gap-4 py-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="min-w-0">
                    <div className="font-bold text-white truncate">{user.name}</div>
                    <div className="text-gray-300/80 text-sm truncate">D: {user.downloadTime}</div>
                </div>
                <div className="flex flex-row gap-2 items-center shrink-0">
                    <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full whitespace-nowrap">
                        {user.episode}
                    </span>
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full whitespace-nowrap">
                        {user.translator}
                    </span>
                </div>
            </div>

            <div className="flex flex-row gap-2 items-center flex-none">
                <span
                    className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${
                        user.synchronized ? "bg-green-500 text-white" : "bg-red-500 text-white"
                    }`}
                >
                    {user.synchronized ? "Sync" : "No sync"}
                </span>
            </div>
        </div>
    );
}

export function UserList({ users }) {
    return (
        <ul className="divide-y divide-white/10 max-h-[70vh] overflow-y-auto overflow-x-hidden">
            {users.map((user, index) => (
                <li key={index}>
                    <User user={user} />
                </li>
            ))}
        </ul>
    );
}