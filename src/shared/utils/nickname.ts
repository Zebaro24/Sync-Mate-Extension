export function generateNickname(): string {
    const adjectives: string[] = [
        "Грозный",
        "Пухлый",
        "Космический",
        "Чиловый",
        "Дикий",
        "Турбо",
        "Липкий",
        "Сочный",
        "Мистер",
        "Электро",
    ];

    const nouns: string[] = [
        "Бобр",
        "Арбуз",
        "Кактус",
        "Бургер",
        "Краб",
        "Пельмень",
        "Лосось",
        "Котлета",
        "Огурец",
        "Космобой",
    ];

    const emojis: string[] = ["🔥", "💀", "🚀", "😎", "🍕", "🦄", "🐸", "🥒"];

    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const emoji =
        Math.random() > 0.5
            ? "-" + emojis[Math.floor(Math.random() * emojis.length)]
            : "";

    return adjective + "-" + noun + emoji;
}
