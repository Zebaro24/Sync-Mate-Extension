import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RoomContainer } from "@/features/room/components/containers/room-container";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 0,
        },
    },
});

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <div className="min-h-screen bg-gradient-to-b from-[#03001C] to-[#15001C] text-white flex items-center justify-center p-3">
                <div className="rounded-2xl shadow-2xl bg-white/4 backdrop-blur-lg border border-white/8 w-[380px] overflow-hidden">
                    <RoomContainer />
                </div>
            </div>
        </QueryClientProvider>
    );
}
