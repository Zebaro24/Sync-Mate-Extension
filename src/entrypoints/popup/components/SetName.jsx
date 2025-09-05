import {useState} from "react";

export default function SetName({onSubmit}) {
    const [name, setName] = useState("Guest");

    function handleSubmit(e) {
        e.preventDefault();
        onSubmit?.(name.trim());
    }

    function handleRandomize() {
        const generated = generateName();
        setName(generated);
    }

    return (
        <div className="w-[300px]">
            <h2 className="flex justify-center items-center gap-2 border-b-2 border-white/10 pb-2 mb-4">
                <div className="text-2xl font-bold text-white">Ваше имя</div>
            </h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <label className="text-sm text-white/80" htmlFor="username">Введите имя, чтобы другие могли вас
                    узнать</label>

                <input
                    id="username"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Например: Alex"
                    className="w-full px-3 py-2 rounded-lg bg-white/10 text-white placeholder-white/40 border border-white/10 outline-none focus:border-white/30"
                    maxLength={24}
                    autoFocus
                />

                <div className="flex gap-2 justify-end">
                    <button
                        type="button"
                        onClick={handleRandomize}
                        className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm border border-white/10"
                    >
                        Случайное
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/10 disabled:text-white/50 text-white text-sm"
                    >
                        Сохранить
                    </button>
                </div>
            </form>
        </div>
    );
}

function generateName() {
    const adjectives = [
        "Быстрый", "Смелый", "Яркий", "Тихий", "Ловкий", "Мудрый", "Солнечный", "Лунный", "Добрый", "Северный"
    ];
    const animals = [
        "Тигр", "Кит", "Сокол", "Лев", "Заяц", "Ёж", "Рысь", "Панда", "Волк", "Дельфин"
    ];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const animal = animals[Math.floor(Math.random() * animals.length)];
    return `${adj}-${animal}`;
}
