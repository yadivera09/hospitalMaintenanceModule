'use client'

/**
 * src/app/(admin)/layout.tsx
 * Layout base del panel Administrador.
 * Estructura:
 *   ┌────────────────────────────────┐
 *   │  Sidebar (fijo, 256 px)        │  ←  oculto en móvil
 *   │                                │
 *   ├────────────────────────────────│
 *   │  Navbar (sticky top)           │
 *   ├────────────────────────────────│
 *   │  Main content                  │
 *   └────────────────────────────────┘
 *
 * Modo responsive:
 *   - Desktop (lg+): sidebar visible como columna fija a la izquierda
 *   - Móvil (<lg): sidebar se muestra como drawer deslizante con overlay
 *
 * Usuario mock — se reemplaza en BLOQUE 2 al conectar Supabase Auth.
 */

import { useState } from 'react'
import Sidebar from '@/components/admin/Sidebar'
import Navbar from '@/components/admin/Navbar'
import type { UsuarioSesion } from '@/types'

// Mock de usuario autenticado — solo para BLOQUE 1
const MOCK_USUARIO: UsuarioSesion = {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@mobilhospital.com',
    nombre: 'Carlos',
    apellido: 'Mendoza',
    rol: 'administrador',
}

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false)

    return (
        <div className="flex h-screen w-full overflow-hidden bg-[#F8FAFC] font-sans">

            {/* ── Sidebar ─────────────────────────────────────── */}
            <Sidebar
                mobileOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            {/* ── Columna derecha (navbar + contenido) ────────── */}
            <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

                {/* Navbar sticky */}
                <Navbar
                    onMenuClick={() => setSidebarOpen(true)}
                    usuario={MOCK_USUARIO}
                />

                {/* Área de contenido principal */}
                <main
                    id="admin-main-content"
                    className="flex-1 overflow-y-auto px-4 py-6 lg:px-8"
                >
                    {children}
                </main>
            </div>
        </div>
    )
}
