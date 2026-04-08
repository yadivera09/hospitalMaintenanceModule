# tech-stack.md — Mobilhospital Maintenance Module

## LENGUAJES
- TypeScript 5.x (frontend y backend)
- SQL (PostgreSQL — Supabase)

---

## FRONTEND
- Framework:     Next.js 14 (App Router)
- Estilos:       Tailwind CSS 3.x
- Componentes:   shadcn/ui (basado en Radix UI)
- Formularios:   react-hook-form + zod
- Estado:        Zustand (estado global ligero) + React Server Components
- Firma digital: react-signature-canvas
- Offline:       IndexedDB via idb (wrapper ligero)
- Iconos:        lucide-react

## SKILLS DE GITHUB RECOMENDADAS PARA ANTIGRAVITY
  - shadcn/ui snippets
  - next-app-router-patterns
  - react-hook-form-zod
  - supabase-nextjs-auth

---

## BACKEND / BASE DE DATOS
- BaaS:          Supabase (PostgreSQL gestionado)
- Auth:          Supabase Auth (JWT con roles custom en metadata)
- Storage:       Supabase Storage (para firmas en base64 → archivo)
- Funciones:     PostgreSQL Functions (RPC) para transacciones críticas
- ORM/Query:     Supabase JS Client v2 (sin ORM adicional)

## SKILLS DE GITHUB RECOMENDADAS PARA ANTIGRAVITY
  - supabase-rpc-transactions
  - supabase-row-level-security
  - postgres-uuid-patterns

---

## DISEÑO / UI-UX
- Sistema de diseño: shadcn/ui como base, personalizado con tokens propios
- Tipografía:        Inter (Google Fonts)
- Paleta:            Azul corporativo (#1E40AF) + grises neutros + semáforo
                     (verde operativo, rojo no operativo, amarillo vencido)
- Firma digital:     Canvas responsivo adaptado a pantallas táctiles
- Modo móvil:        Layout responsivo prioritario (los técnicos usan celular)
- Indicador offline: Banner persistente cuando no hay conexión

## SKILLS DE GITHUB RECOMENDADAS PARA ANTIGRAVITY
  - tailwind-design-tokens
  - shadcn-dashboard-layout
  - mobile-first-forms

---

## HERRAMIENTAS DE DESARROLLO
- Linter:      ESLint con config Next.js
- Formatter:   Prettier
- Testing:     Vitest (unitario) + Playwright (e2e para flujos críticos)
- Control:     Git + GitHub (ramas: main, develop, feature/*)
- CI/CD:       Vercel (deploy automático desde main)

---

## ESTRUCTURA DE CARPETAS

/
├── app/
│   ├── (admin)/              # Rutas del panel administrador
│   │   ├── dashboard/
│   │   ├── clientes/
│   │   ├── contratos/
│   │   ├── equipos/
│   │   ├── tecnicos/
│   │   ├── catalogos/
│   │   └── reportes/
│   ├── (tecnico)/            # Rutas del panel técnico
│   │   ├── dashboard/
│   │   ├── nuevo-reporte/
│   │   └── mis-reportes/
│   ├── api/                  # Route handlers
│   │   ├── clientes/
│   │   ├── contratos/
│   │   ├── equipos/
│   │   ├── reportes/
│   │   └── sync/
│   └── actions/              # Server actions por módulo
├── components/
│   ├── ui/                   # shadcn/ui base
│   ├── admin/                # Componentes del panel admin
│   ├── tecnico/              # Componentes del panel técnico
│   └── shared/               # Componentes compartidos
├── lib/
│   ├── supabase/             # Cliente Supabase (server y client)
│   ├── validations/          # Schemas zod
│   └── utils/                # Helpers generales
├── types/                    # Tipos TypeScript globales
├── db/
│   ├── schema.sql            # Fuente de verdad del schema
│   └── seeds/                # Datos base
└── design/
    └── tokens.md             # Variables de diseño
```

---

## RESPUESTA A TU PREGUNTA: ¿Empezar por el técnico o el administrador?

**Recomendación: empezar por el panel del Administrador.**

Las razones son concretas:

**1. Dependencia de catálogos.** El técnico no puede crear un reporte si no existen clientes, contratos, equipos, categorías y checklist cargados. Todos esos datos los gestiona el administrador. Si empiezas por el técnico, estarías construyendo el formulario más complejo del sistema sobre un vacío.

**2. El formulario del técnico es el más complejo.** Involucra búsqueda de equipo, checklist dinámico, múltiples técnicos, insumos y firmas digitales. Construirlo primero sin tener los datos maestros listos genera iteraciones innecesarias.

**3. El administrador valida la lógica de negocio.** Al construir las vistas de equipos, reportes y contratos del admin, vas a detectar errores del modelo de datos antes de que lleguen al formulario del técnico, que es el proceso más crítico.

**4. El panel admin es más predecible.** Son mayormente tablas CRUD con listados y filtros. El panel técnico tiene modo offline, firma canvas y checklist dinámico, que son los componentes más frágiles. Construirlos al final, cuando el resto del sistema está estable, reduce el riesgo.

**Orden concreto dentro del frontend:**
```
Admin: Dashboard → Clientes → Contratos → Equipos → Técnicos
     → Catálogos → Reportes (solo lectura por ahora)
Técnico: Dashboard → Búsqueda equipo → Nuevo Reporte → Firma → Offline