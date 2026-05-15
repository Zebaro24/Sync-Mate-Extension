import type { ReactNode } from "react";

type BadgeVariant = "green" | "blue" | "purple" | "red" | "gray" | "indigo";

const variantClasses: Record<BadgeVariant, string> = {
    green: "bg-green-500/20 text-green-300 border-green-500/30",
    blue: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    purple: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    red: "bg-red-500/20 text-red-300 border-red-500/30",
    gray: "bg-white/8 text-white/50 border-white/10",
    indigo: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
};

interface BadgeProps {
    children: ReactNode;
    variant?: BadgeVariant;
    className?: string;
}

export function Badge({
    children,
    variant = "gray",
    className = "",
}: BadgeProps) {
    return (
        <span
            className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full border whitespace-nowrap ${variantClasses[variant]} ${className}`}
        >
            {children}
        </span>
    );
}
