import { Skeleton } from "@/shared/components/ui/skeleton";

function UserCardSkeleton() {
    return (
        <div className="flex items-center gap-3 px-4 py-3 border-l-2 border-transparent">
            <Skeleton className="w-9 h-9 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-5 w-5 rounded-full shrink-0" />
        </div>
    );
}

export function RoomSkeleton() {
    return (
        <div>
            <div className="px-4 pt-4 pb-3.5 border-b border-white/6">
                <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-7 w-20 rounded-xl" />
                </div>
            </div>

            <ul className="divide-y divide-white/5">
                {[1, 2, 3].map((i) => (
                    <li key={i}>
                        <UserCardSkeleton />
                    </li>
                ))}
            </ul>

            <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
            </div>
        </div>
    );
}
