import { fileURLToPath } from "url";
import { defineConfig } from "vite";

export default defineConfig({
    base: "tokituduri",
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
});