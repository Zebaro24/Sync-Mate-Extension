import axios from "axios";
import { API_URL } from "@/shared/constants/api";

export const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
    timeout: 10_000,
});
