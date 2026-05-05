'use client'

/**
 * src/app/(admin)/admin/seguridad/roles/RolesPageClient.tsx
 * Client Component — Lista de roles con CRUD inline.
 * Patrón idéntico a ContratosPageClient.tsx.
 */

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    ShieldCheck,
    Plus,
    AlertCircle,
    Settings,
    Trash2,
    Lock,
    Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { crearRol, eliminarRol } from '@/app/actions/seguridad/roles'
import type { RolConPermisos } from '@/app/actions/seguridad/roles'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
    rolesIniciales: RolConPermisos[]
    errorInicial: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

export default function RolesPageClient({ rolesIniciales, errorInicial }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    // ── Estado modales ─────────────────────────────────────────────────────────
    const [modalCrearAbierto, setModalCrearAbierto] = useState(false)
    const [modalEliminarRol, setModalEliminarRol] = useState<RolConPermisos | null>(null)

    // ── Estado Local Roles ──────────────────────────────────────────────────────
    const [roles, setRoles] = useState<RolConPermisos[]>(rolesIniciales)

    useEffect(() => {
        setRoles(rolesIniciales)
    }, [rolesIniciales])

    // ── Estado formulario crear ────────────────────────────────────────────────
    const [nombreNuevo, setNombreNuevo] = useState('')
    const [descripcionNueva, setDescripcionNueva] = useState('')
    const [errorForm, setErrorForm] = useState<string | null>(null)
    const [guardando, setGuardando] = useState(false)

    // ── Estado eliminar ────────────────────────────────────────────────────────
    const [errorEliminar, setErrorEliminar] = useState<string | null>(null)
    const [eliminando, setEliminando] = useState(false)

    // Contadores para subtítulo
    const totalSistema = roles.filter((r) => r.es_sistema).length

    // ── Handlers ──────────────────────────────────────────────────────────────

    function cerrarModalCrear() {
        setModalCrearAbierto(false)
        setNombreNuevo('')
        setDescripcionNueva('')
        setErrorForm(null)
    }

    async function handleCrearRol(e: React.FormEvent) {
        e.preventDefault()
        if (!nombreNuevo.trim()) { setErrorForm('El nombre es obligatorio.'); return }
        setGuardando(true)
        setErrorForm(null)

        const result = await crearRol({ nombre: nombreNuevo.trim(), descripcion: descripcionNueva.trim() || null })

        setGuardando(false)
        if (result.error) { setErrorForm(result.error); return }

        cerrarModalCrear()
        startTransition(() => { router.refresh() })
    }

    function abrirModalEliminar(rol: RolConPermisos) {
        setModalEliminarRol(rol)
        setErrorEliminar(null)
    }

    async function handleEliminarRol() {
        if (!modalEliminarRol) return
        setEliminando(true)
        setErrorEliminar(null)

        const result = await eliminarRol(modalEliminarRol.id)

        setEliminando(false)
        if (result.error) { setErrorEliminar(result.error); return }

        setRoles(prev => prev.filter(r => r.id !== modalEliminarRol.id))
        setModalEliminarRol(null)
        startTransition(() => { router.refresh() })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            {/* ── Encabezado ── */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E40AF]/10">
                        <ShieldCheck className="h-5 w-5 text-[#1E40AF]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[#0F172A] leading-none">Roles</h1>
                        <p className="text-sm text-[#94A3B8] mt-0.5">
                            {roles.length} roles · {totalSistema} de sistema
                        </p>
                    </div>
                </div>

                <Button
                    onClick={() => setModalCrearAbierto(true)}
                    className="bg-[#1E40AF] hover:bg-[#1E3A8A] text-white gap-2 shrink-0"
                    id="btn-nuevo-rol"
                >
                    <Plus className="h-4 w-4" />
                    Nuevo Rol
                </Button>
            </div>

            {/* Error de carga */}
            {errorInicial && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {errorInicial}
                </div>
            )}

            {/* ── Tabla de roles ── */}
            <div className="rounded-xl bg-white border border-[#E2E8F0] shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-[#F8FAFC] hover:bg-[#F8FAFC]">
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 pl-5">
                                Nombre
                            </TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 hidden md:table-cell">
                                Descripción
                            </TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3">
                                Estado
                            </TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 text-right pr-5">
                                Acciones
                            </TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {roles.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="py-16 text-center">
                                    <div className="flex flex-col items-center justify-center">
                                        <ShieldCheck className="h-8 w-8 text-[#E2E8F0] mb-3" />
                                        <p className="text-sm text-[#94A3B8]">No hay roles configurados.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            roles.map((rol) => (
                                <TableRow 
                                    key={rol.id}
                                    className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors cursor-pointer group"
                                    onClick={() => router.push(`/admin/seguridad/roles/${rol.id}`)}
                                >
                                    {/* Nombre */}
                                    <TableCell className="py-3.5 pl-5">
                                        <div className="flex items-center gap-2">
                                            {rol.es_sistema && (
                                                <Lock className="h-3.5 w-3.5 text-[#94A3B8] shrink-0" aria-label="Rol de sistema" />
                                            )}
                                            <span className="text-sm font-semibold text-[#0F172A]">
                                                {rol.nombre}
                                            </span>
                                        </div>
                                    </TableCell>

                                    {/* Descripción */}
                                    <TableCell className="py-3.5 hidden md:table-cell">
                                        <span className="text-sm text-[#64748B] truncate max-w-[300px] block">
                                            {rol.descripcion ?? <span className="text-[#CBD5E1] italic">Sin descripción</span>}
                                        </span>
                                    </TableCell>

                                    {/* Estado */}
                                    <TableCell className="py-3.5">
                                        {rol.activo ? (
                                            <Badge className="bg-green-50 text-green-700 border border-green-200 text-xs font-medium px-2 py-0.5 rounded-sm">
                                                Activo
                                            </Badge>
                                        ) : (
                                            <Badge className="bg-[#F1F5F9] text-[#94A3B8] border border-[#E2E8F0] text-xs font-medium px-2 py-0.5 rounded-sm">
                                                Inactivo
                                            </Badge>
                                        )}
                                    </TableCell>

                                    {/* Acciones */}
                                    <TableCell className="py-3.5 pr-5" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-end gap-1">
                                            {/* Configurar permisos / Editar */}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => router.push(`/admin/seguridad/roles/${rol.id}`)}
                                                className="h-8 w-8 p-0 text-[#94A3B8] hover:text-[#1E40AF] hover:bg-blue-50"
                                                id={`btn-editar-rol-${rol.id}`}
                                                title="Configurar permisos"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            
                                            {/* Eliminar */}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => !rol.es_sistema && abrirModalEliminar(rol)}
                                                disabled={rol.es_sistema}
                                                className="h-8 w-8 p-0 text-[#94A3B8] hover:text-red-600 hover:bg-red-50 disabled:opacity-30"
                                                id={`btn-eliminar-rol-${rol.id}`}
                                                title={rol.es_sistema ? 'Rol de sistema protegido' : 'Eliminar'}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC]">
                    <p className="text-xs text-[#94A3B8]">
                        {isPending ? 'Actualizando…' : `${roles.length} roles registrados`}
                    </p>
                </div>
            </div>

            {/* ── Modal: Crear rol ── */}
            <Dialog open={modalCrearAbierto} onOpenChange={(open) => !open && cerrarModalCrear()}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-[#0F172A]">Nuevo Rol</DialogTitle>
                        <DialogDescription className="text-[#94A3B8]">
                            Completa los datos para crear un nuevo rol en el sistema.
                        </DialogDescription>
                    </DialogHeader>

                    {errorForm && (
                        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            {errorForm}
                        </div>
                    )}

                    <form onSubmit={handleCrearRol} className="space-y-4 mt-2">
                        {/* Nombre */}
                        <div className="space-y-1.5">
                            <label htmlFor="rol-nombre" className="text-sm font-medium text-[#0F172A]">
                                Nombre <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="rol-nombre"
                                type="text"
                                value={nombreNuevo}
                                onChange={(e) => setNombreNuevo(e.target.value)}
                                placeholder="ej: supervisor_regional"
                                className="w-full rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/30 focus:border-[#1E40AF]"
                            />
                        </div>

                        {/* Descripción */}
                        <div className="space-y-1.5">
                            <label htmlFor="rol-descripcion" className="text-sm font-medium text-[#0F172A]">
                                Descripción <span className="text-[#94A3B8] font-normal">(opcional)</span>
                            </label>
                            <textarea
                                id="rol-descripcion"
                                value={descripcionNueva}
                                onChange={(e) => setDescripcionNueva(e.target.value)}
                                placeholder="Describe los permisos y responsabilidades de este rol"
                                rows={3}
                                className="w-full rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/30 focus:border-[#1E40AF] resize-none"
                            />
                        </div>

                        {/* Nota: es_sistema nunca se puede asignar */}
                        <p className="text-xs text-[#94A3B8] bg-[#F8FAFC] rounded-md px-3 py-2 border border-[#E2E8F0]">
                            Los roles creados aquí son de tipo <strong>Custom</strong> y pueden eliminarse en cualquier momento.
                        </p>

                        {/* Botones */}
                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={cerrarModalCrear}
                                className="border-[#E2E8F0] text-[#64748B]"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={guardando}
                                className="bg-[#1E40AF] hover:bg-[#1E3A8A] text-white"
                            >
                                {guardando ? 'Guardando…' : 'Crear rol'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── Modal: Confirmar eliminar ── */}
            <Dialog
                open={!!modalEliminarRol}
                onOpenChange={(open) => { if (!open) { setModalEliminarRol(null); setErrorEliminar(null) } }}
            >
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-[#0F172A]">Eliminar rol</DialogTitle>
                        <DialogDescription className="text-[#94A3B8]">
                            Esta acción no se puede deshacer.
                        </DialogDescription>
                    </DialogHeader>

                    <p className="text-sm text-[#334155]">
                        ¿Seguro que deseas eliminar el rol{' '}
                        <strong className="text-[#0F172A]">{modalEliminarRol?.nombre}</strong>?
                        Los usuarios con este rol perderán el acceso asociado.
                    </p>

                    {errorEliminar && (
                        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            {errorEliminar}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            variant="outline"
                            onClick={() => { setModalEliminarRol(null); setErrorEliminar(null) }}
                            className="border-[#E2E8F0] text-[#64748B]"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleEliminarRol}
                            disabled={eliminando}
                            className="bg-red-600 hover:bg-red-700 text-white"
                            id="btn-confirmar-eliminar-rol"
                        >
                            {eliminando ? 'Eliminando…' : 'Eliminar'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
