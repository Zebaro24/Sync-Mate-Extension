import { useState, useEffect, useRef } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface EditModalProps {
    title: string;
    initialValue: string;
    placeholder?: string;
    note?: string;
    isLoading?: boolean;
    onSave: (value: string) => void;
    onClose: () => void;
}

export function EditModal({
    title,
    initialValue,
    placeholder,
    note,
    isLoading,
    onSave,
    onClose,
}: EditModalProps) {
    const [value, setValue] = useState(initialValue);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (trimmed) onSave(trimmed);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") onClose();
    };

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-[#0D0820] border border-white/10 rounded-2xl shadow-2xl w-full max-w-[300px] p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white">
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-white/30 hover:text-white/70 transition-colors"
                    >
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <input
                        ref={inputRef}
                        type="text"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        maxLength={50}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20 transition-all"
                    />
                    {note && (
                        <p className="mt-2 text-[10px] text-white/30 leading-relaxed">
                            {note}
                        </p>
                    )}
                    <div className="flex gap-2 mt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2 text-xs text-white/50 bg-white/5 hover:bg-white/8 border border-white/8 rounded-xl transition-colors"
                        >
                            Отмена
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading ?? !value.trim()}
                            className="flex-1 py-2 text-xs text-white font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors"
                        >
                            {isLoading ? "..." : "Сохранить"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
