/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./pages/**/*.{js,ts,jsx,tsx}",
        "./contexts/**/*.{js,ts,jsx,tsx}",
        "./hooks/**/*.{js,ts,jsx,tsx}",
        "./layouts/**/*.{js,ts,jsx,tsx}",
        "./*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'gray-cyan': '#54a09b',
                'navy-blue': '#000080',
                'vivid-red': '#fb6163',
            },
            boxShadow: {
                'neon-cyan': '0 0 15px rgba(84, 160, 155, 0.6), 0 0 5px rgba(84, 160, 155, 0.8)',
            }
        },
    },
    plugins: [],
}
