import type { Config } from "tailwindcss";

const config: Config = {
	darkMode: ["class"],
	content: [
		"./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/components/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/app/**/*.{js,ts,jsx,tsx,mdx}",
	],
	theme: {
		extend: {
			// ── shadcn/ui base (no modificar) ───────────────────────────────────
			colors: {
				background: "hsl(var(--background))",
				foreground: "hsl(var(--foreground))",
				card: {
					DEFAULT: "hsl(var(--card))",
					foreground: "hsl(var(--card-foreground))",
				},
				popover: {
					DEFAULT: "hsl(var(--popover))",
					foreground: "hsl(var(--popover-foreground))",
				},
				primary: {
					DEFAULT: "hsl(var(--primary))",
					foreground: "hsl(var(--primary-foreground))",
				},
				secondary: {
					DEFAULT: "hsl(var(--secondary))",
					foreground: "hsl(var(--secondary-foreground))",
				},
				muted: {
					DEFAULT: "hsl(var(--muted))",
					foreground: "hsl(var(--muted-foreground))",
				},
				accent: {
					DEFAULT: "hsl(var(--accent))",
					foreground: "hsl(var(--accent-foreground))",
				},
				destructive: {
					DEFAULT: "hsl(var(--destructive))",
					foreground: "hsl(var(--destructive-foreground))",
				},
				border: "hsl(var(--border))",
				input: "hsl(var(--input))",
				ring: "hsl(var(--ring))",
				chart: {
					"1": "hsl(var(--chart-1))",
					"2": "hsl(var(--chart-2))",
					"3": "hsl(var(--chart-3))",
					"4": "hsl(var(--chart-4))",
					"5": "hsl(var(--chart-5))",
				},
				// ── Tokens de tema (claro/oscuro) ────────────────────────────────
				// Definidos en globals.css. Van con var() plano, no con el
				// triplete HSL de shadcn, así que NO admiten el modificador de
				// opacidad: `bg-panel/50` no compila. Para eso están los *-suave.
				superficie: "var(--superficie)",
				panel: {
					DEFAULT: "var(--panel)",
					suave: "var(--panel-suave)",
					alto: "var(--panel-alto)",
				},
				borde: {
					DEFAULT: "var(--borde)",
					suave: "var(--borde-suave)",
				},
				tinta: {
					DEFAULT: "var(--tinta)",
					media: "var(--tinta-media)",
					tenue: "var(--tinta-tenue)",
				},
				marca: {
					DEFAULT: "var(--marca)",
					fuerte: "var(--marca-fuerte)",
					suave: "var(--marca-suave)",
					linea: "var(--marca-linea)",
					tinta: "var(--marca-tinta)",
				},
				reja: "var(--reja)",
				// DEFAULT es la marca de gráfico — barras y puntos, paleta fija.
				// *-suave es el fondo tintado; *-linea, el filete que lo cierra;
				// *-tinta, el color cuando hace de texto. Para escribir, SIEMPRE
				// la variante -tinta: el DEFAULT está calibrado para leerse como
				// señal, no como palabra.
				ok: {
					DEFAULT: "var(--ok)",
					suave: "var(--ok-suave)",
					linea: "var(--ok-linea)",
					tinta: "var(--ok-tinta)",
				},
				aviso: {
					DEFAULT: "var(--aviso)",
					suave: "var(--aviso-suave)",
					linea: "var(--aviso-linea)",
					tinta: "var(--aviso-tinta)",
				},
				grave: {
					DEFAULT: "var(--grave)",
					suave: "var(--grave-suave)",
					linea: "var(--grave-linea)",
					tinta: "var(--grave-tinta)",
				},
				critico: {
					DEFAULT: "var(--critico)",
					suave: "var(--critico-suave)",
					linea: "var(--critico-linea)",
					tinta: "var(--critico-tinta)",
				},
				serie: {
					"1": "var(--serie-1)",
					"2": "var(--serie-2)",
					"3": "var(--serie-3)",
					otros: "var(--serie-otros)",
				},

				// ── Paleta Mobilhospital ─────────────────────────────────────────
				brand: {
					DEFAULT: "#1E40AF", // Azul corporativo
					light: "#3B82F6",   // Hover de botones
					dark: "#1E3A8A",    // Active/pressed
				},
				operativo: "#16A34A", // Equipo operativo (verde)
				vencido: "#D97706", // Mantenimiento vencido (ámbar)
				inoperativo: "#DC2626", // No operativo (rojo)
			},
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
				// base del sistema = 0.5rem definido en globals.css como --radius
			},
			// ── Tipografía Mobilhospital ─────────────────────────────────────────
			fontFamily: {
				sans: ["Inter", "sans-serif"],
			},
		},
	},
	plugins: [require("tailwindcss-animate")],
};

export default config;
