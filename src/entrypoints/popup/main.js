import {getItem, setItem} from "@/shared/storage";

const input = document.getElementById("nameInput");
const btn = document.getElementById("saveBtn");
const status = document.getElementById("status");

getItem("name").then(name => {
    if (name) input.value = name;
})


btn.addEventListener("click", () => {
    const name = input.value.trim();
    setItem("name", name).then(() => {
        status.textContent = "Saved ✅";
        setTimeout(() => (status.textContent = ""), 1500);
    })
});
