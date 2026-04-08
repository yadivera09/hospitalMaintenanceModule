# design/tokens.md — Sistema de Diseño Mobilhospital

## PALETA DE COLORES

| Token | Hex | Uso |
|---|---|---|
| `--color-primary` | `#1E40AF` | Azul corporativo — navbar, botones primarios, encabezados |
| `--color-primary-light` | `#3B82F6` | Hover de botones primarios, links activos |
| `--color-primary-dark` | `#1E3A8A` | Estado pressed/active de botones |
| `--color-success` | `#16A34A` | Estado operativo del equipo, confirmaciones, badge "activo" |
| `--color-warning` | `#D97706` | Mantenimiento vencido o próximo a vencer, alertas intermedias |
| `--color-error` | `#DC2626` | No operativo, error crítico, estado equipos fuera de servicio |
| `--color-neutral-50` | `#F8FAFC` | Fondo general de páginas |
| `--color-neutral-100` | `#F1F5F9` | Fondo de cards y paneles |
| `--color-neutral-200` | `#E2E8F0` | Bordes suaves, divisores |
| `--color-neutral-400` | `#94A3B8` | Texto secundario, placeholders |
| `--color-neutral-700` | `#334155` | Texto principal en bodys |
| `--color-neutral-900` | `#0F172A` | Texto en encabezados y títulos |

---

## TIPOGRAFÍA

| Token | Valor | Uso |
|---|---|---|
| `--font-family` | `Inter, sans-serif` | Fuente base en todo el sistema |
| `--font-size-xs` | `0.75rem (12px)` | Badges, etiquetas pequeñas |
| `--font-size-sm` | `0.875rem (14px)` | Texto de tabla, ayudas contextuales |
| `--font-size-base` | `1rem (16px)` | Cuerpo de texto general |
| `--font-size-lg` | `1.125rem (18px)` | Subtítulos de sección |
| `--font-size-xl` | `1.25rem (20px)` | Títulos de página |
| `--font-size-2xl` | `1.5rem (24px)` | Encabezados principales |
| `--font-weight-normal` | `400` | Texto general |
| `--font-weight-medium` | `500` | Labels, Items de menú |
| `--font-weight-semibold` | `600` | Subtítulos, botones |
| `--font-weight-bold` | `700` | Títulos de página |

---

## ESPACIADO

| Token | Valor | Uso |
|---|---|---|
| `--spacing-1` | `0.25rem (4px)` | Margen mínimo |
| `--spacing-2` | `0.5rem (8px)` | Padding interno de badges |
| `--spacing-4` | `1rem (16px)` | Padding base de componentes |
| `--spacing-6` | `1.5rem (24px)` | Separación entre secciones |
| `--spacing-8` | `2rem (32px)` | Padding de contenedores de página |

---

## BORDER RADIUS

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | `0.25rem` | Inputs pequeños, badges |
| `--radius-base` | `0.5rem` | **Base del sistema** — cards, botones, inputs estándar |
| `--radius-lg` | `0.75rem` | Modales, paneles laterales |
| `--radius-full` | `9999px` | Pills, avatares circulares |

---

## SOMBRAS

| Token | Valor | Uso |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Cards planas |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` | Cards con hover, dropdowns |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modales, popovers |

---

## SEMÁFORO DE ESTADO DE EQUIPOS

| Estado | Color | Token | Clase Tailwind equivalente |
|---|---|---|---|
| Operativo | `#16A34A` | `--color-success` | `text-green-600 bg-green-50` |
| Vencido / Próximo | `#D97706` | `--color-warning` | `text-amber-600 bg-amber-50` |
| No operativo | `#DC2626` | `--color-error` | `text-red-600 bg-red-50` |
| En mantenimiento | `#2563EB` | `--color-primary-light` | `text-blue-600 bg-blue-50` |

---

## REGLAS DE DISEÑO

1. **No usar esquinas uniformes muy redondeadas** (`rounded-full` solo en pills/avatares)
2. **No usar fondos purpuras ni gradientes genéricos** — el color primario es azul corporativo
3. **No centrar layouts completos** — máximo `max-w-7xl mx-auto` con alineación izquierda
4. **Mobile-first obligatorio** — el panel del Técnico se usa principalmente en celular
5. **Densidad informativa alta** — las tablas del Admin deben mostrar datos útiles sin paginación excesiva
6. **Indicador offline persistente** — siempre visible en el panel del Técnico cuando no hay red
