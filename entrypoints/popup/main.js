/* global browser */
const input = document.getElementById("nameInput");
const btn = document.getElementById("saveBtn");
const status = document.getElementById("status");

// При открытии popup подгружаем сохранённое имя
browser.storage.local.get("name", (result) => {
    if (result.name) {
        input.value = result.name;
    }
});

// Сохраняем имя при нажатии кнопки
btn.addEventListener("click", () => {
    const name = input.value.trim();
    browser.storage.local.set({ name }, () => {
        status.textContent = "Saved ✅";
        setTimeout(() => (status.textContent = ""), 1500);
    });
});
