import Room from "./components/Room";
// import SetName from "./components/SetName";

export default function App() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-[#03001C] to-[#15001C] text-white p-4 flex items-center justify-center">
            <div className="rounded-2xl shadow-xl bg-gray-200/8 backdrop-blur-lg border border-white/4 max-w-2xl w-full">
                {/*<SetName onSubmit={() => {}}/>*/}
                <Room />
            </div>
        </div>
    );
}
