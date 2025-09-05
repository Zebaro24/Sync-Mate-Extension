import {UserList} from "./User.jsx";
import {browser} from "#imports";

export default function Room({ room }) {
    return (
        <div className="w-[300px]">
            <header className="flex justify-center items-center gap-2 border-b-2 border-white/10 pb-2 mb-2 -mx-4">
                <img
                    src={browser.runtime.getURL("icon/48.png")}
                    alt="App icon"
                    className="w-8 h-8"
                />
                <h2 className="text-2xl font-bold text-white">
                    Room: {room.name}
                </h2>
            </header>

            <UserList users={room.users} />
        </div>


    );
}
