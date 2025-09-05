import Room from "./components/Room.jsx";
// import SetName from "./components/SetName.jsx";

const room = {
    name: "test",
    users: [
        {name: "Guest1", downloadTime: "2:02", translator: "Оригинальная", episode: "S:1 E:12", synchronized: true},
        {name: "Guest2", downloadTime: "2:02", translator: "Оригинальная", episode: "S:1 E:13", synchronized: false},
        {name: "Guest3", downloadTime: "2:02", translator: "TVShows", episode: "S:1 E:12", synchronized: true},
    ],
}

export default function App() {
    return (
        <div
            className="min-h-screen bg-gradient-to-b from-[#03001C] to-[#15001C] text-white p-4 flex items-center justify-center">
            <div
                className="p-4 rounded-2xl shadow-xl bg-gray-200/8 backdrop-blur-lg border border-white/4 max-w-2xl w-full">
                {/*<SetName onSubmit={() => {}}/>*/}
                <Room room={room}/>
            </div>
        </div>
    );
}