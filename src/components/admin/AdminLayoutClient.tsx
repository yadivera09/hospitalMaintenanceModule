'use client'

/**
 * src/components/admin/AdminLayoutClient.tsx
 * Lógica de cliente para el layout del panel administrador.
 * Maneja el estado del sidebar, el tema claro/oscuro y la estructura base.
 */

import { useState } from 'react'
import Sidebar from '@/components/admin/Sidebar'
import Navbar from '@/components/admin/Navbar'
import { guardarTema, type Tema } from '@/lib/tema/tema'
import type { UsuarioSesion } from '@/types'
import type { MenuNav } from '@/lib/seguridad/navegacion'

interface AdminLayoutClientProps {
    children: React.ReactNode
    usuario: UsuarioSesion
    /** Navegación ya filtrada por permisos en el servidor */
    navegacion: MenuNav[]
    /** Tema leído de la cookie en el servidor: evita el destello al cargar */
    temaInicial: Tema
}

export default function AdminLayoutClient({
    children,
    usuario,
    navegacion,
    temaInicial,
}: AdminLayoutClientProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [tema, setTema] = useState<Tema>(temaInicial)

    function alternarTema() {
        const siguiente: Tema = tema === 'oscuro' ? 'claro' : 'oscuro'
        setTema(siguiente)
        guardarTema(siguiente)
    }

    return (
        // La clase 'dark' va aquí y no en <html>: fuera del panel las pantallas
        // usan colores fijos y no participan del tema (ver lib/tema/tema.ts).
        <div className={tema === 'oscuro' ? 'dark' : undefined}>
            <div className="flex h-screen w-full overflow-hidden bg-superficie font-sans">

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
                        tema={tema}
                        onAlternarTema={alternarTema}
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
        </div>
    )
}
