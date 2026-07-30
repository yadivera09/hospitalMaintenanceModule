'use client'

/**
 * src/components/admin/AdminLayoutClient.tsx
 * Lógica de cliente para el layout del panel administrador.
 * Maneja el estado del sidebar y renderiza la estructura base.
 */

import { useState } from 'react'
import Sidebar from '@/components/admin/Sidebar'
import Navbar from '@/components/admin/Navbar'
import type { UsuarioSesion } from '@/types'
import type { MenuNav } from '@/lib/seguridad/navegacion'

interface AdminLayoutClientProps {
    children: React.ReactNode
    usuario: UsuarioSesion
    /** Navegación ya filtrada por permisos en el servidor */
    navegacion: MenuNav[]
}

export default function AdminLayoutClient({
    children,
    usuario,
    navegacion
}: AdminLayoutClientProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false)

    return (
        <div className="flex h-screen w-full overflow-hidden bg-[#F8FAFC] font-sans">

            {/* ── Sidebar ─────────────────────────────────────── */}
            <Sidebar
                navegacion={navegacion}
                mobileOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            {/* ── Columna derecha (navbar + contenido) ────────── */}
            <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

                {/* Navbar sticky */}
                <Navbar
                    onMenuClick={() => setSidebarOpen(true)}
                    usuario={usuario}
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
