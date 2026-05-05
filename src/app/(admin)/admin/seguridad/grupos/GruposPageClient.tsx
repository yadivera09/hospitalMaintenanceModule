'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    UsersRound,
    Users,
    Eye,
    Trash2,
    AlertCircle,
    Plus,
    Pencil
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { crearGrupo, eliminarGrupo } from '@/app/actions/seguridad/grupos'
import type { GrupoResumen } from '@/app/actions/seguridad/grupos'
import type { UsuarioConRoles } from '@/app/actions/seguridad/usuarios'

interface Props {
    gruposIniciales: GrupoResumen[]
    usuariosActivos: UsuarioConRoles[]
    errorInicial: string | null
}

export default function GruposPageClient({ gruposIniciales, usuariosActivos, errorInicial }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    const [grupos, setGrupos] = useState<GrupoResumen[]>(gruposIniciales)
    
    // Sincronizar estado local con props del servidor cuando estas cambien (ej: tras router.refresh())
    useEffect(() => {
        setGrupos(gruposIniciales)
    }, [gruposIniciales])
    const [modalCrearAbierto, setModalCrearAbierto] = useState(false)
    const [guardando, setGuardando] = useState(false)
    const [errorGlobal, setErrorGlobal] = useState<string | null>(errorInicial)
    
    const [nombre, setNombre] = useState('')
    const [descripcion, setDescripcion] = useState('')
    const [responsableId, setResponsableId] = useState<string>('sin_asignar')

    const totalActivos = grupos.filter(g => g.activo).length

    function handleAbrirCrear() {
        setNombre('')
        setDescripcion('')
        setResponsableId('sin_asignar')
        setErrorGlobal(null)
        setModalCrearAbierto(true)
    }

    async function handleCrearGrupo() {
        if (!nombre.trim()) {
            setErrorGlobal('El nombre del grupo es obligatorio.')
            return
        }

        setGuardando(true)
        setErrorGlobal(null)

        const result = await crearGrupo({
            nombre,
            descripcion: descripcion.trim() || null,
            responsable_id: responsableId === 'sin_asignar' ? null : responsableId
        })

        if (result.error) {
            setErrorGlobal(result.error)
            setGuardando(false)
            return
        }

        setModalCrearAbierto(false)
        startTransition(() => {
            router.refresh()
            // optimistic refresh handled mostly by server passing new props,
            // but we can let router.refresh update the page
            setGuardando(false)
        })
    }

    async function handleEliminar(id: string) {
        if (!confirm('¿Estás seguro de que deseas eliminar este grupo?')) return
        setErrorGlobal(null)

        const result = await eliminarGrupo(id)
        if (result.error) {
            setErrorGlobal(result.error)
            return
        }

        setGrupos(prev => prev.filter(g => g.id !== id))
        startTransition(() => router.refresh())
    }

    return (
        <div className="space-y-6">
            {/* ── Encabezado ── */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E40AF]/10">
                        <UsersRound className="h-5 w-5 text-[#1E40AF]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[#0F172A] leading-none">Grupos</h1>
                        <p className="text-sm text-[#94A3B8] mt-0.5">
                            {grupos.length} grupos · {totalActivos} activos
                        </p>
                    </div>
                </div>
                <Button 
                    onClick={handleAbrirCrear} 
                    className="bg-[#1E40AF] hover:bg-[#1E3A8A] text-white shadow-sm"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Grupo
                </Button>
            </div>

            {errorGlobal && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {errorGlobal}
                </div>
            )}

            {/* ── Tabla ── */}
            <div className="rounded-xl bg-white border border-[#E2E8F0] shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-[#F8FAFC] hover:bg-[#F8FAFC]">
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 pl-5">
                                Grupo
                            </TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 hidden md:table-cell">
                                Responsable
                            </TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 text-center hidden sm:table-cell">
                                Miembros
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
                        {grupos.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="py-16 text-center">
                                    <div className="flex flex-col items-center justify-center">
                                        <UsersRound className="h-8 w-8 text-[#E2E8F0] mb-3" />
                                        <p className="text-sm font-medium text-[#64748B]">No hay grupos creados</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            grupos.map((grupo) => (
                                <TableRow 
                                    key={grupo.id}
                                    className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors cursor-pointer group"
                                    onClick={() => router.push(`/admin/seguridad/grupos/${grupo.id}`)}
                                >
                                    {/* Grupo */}
                                    <TableCell className="py-3.5 pl-5">
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-sm font-bold text-[#0F172A] truncate">
                                                {grupo.nombre}
                                            </span>
                                            {grupo.descripcion && (
                                                <span className="text-xs text-[#94A3B8] truncate mt-0.5 max-w-[250px]">
                                                    {grupo.descripcion}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>

                                    {/* Responsable */}
                                    <TableCell className="py-3.5 hidden md:table-cell">
                                        {grupo.responsable_nombre ? (
                                            <span className="text-sm text-[#334155]">{grupo.responsable_nombre}</span>
                                        ) : (
                                            <span className="text-xs text-[#94A3B8] italic">Sin responsable</span>
                                        )}
                                    </TableCell>

                                    {/* Miembros */}
                                    <TableCell className="py-3.5 text-center hidden sm:table-cell">
                                        <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-[#0F172A]">
                                            <Users className="h-4 w-4 text-[#94A3B8]" />
                                            {grupo.total_miembros}
                                        </div>
                                    </TableCell>

                                    {/* Estado */}
                                    <TableCell className="py-3.5">
                                        {grupo.activo ? (
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
                                    <TableCell className="py-3.5 pr-5 text-right" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => router.push(`/admin/seguridad/grupos/${grupo.id}`)}
                                                className="h-8 w-8 p-0 text-[#94A3B8] hover:text-[#1E40AF] hover:bg-blue-50"
                                                title="Editar grupo"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleEliminar(grupo.id)}
                                                disabled={grupo.total_miembros > 0}
                                                className="h-8 w-8 p-0 text-[#94A3B8] hover:text-red-600 hover:bg-red-50 disabled:opacity-30"
                                                title={grupo.total_miembros > 0 ? "No se puede eliminar un grupo con miembros" : "Eliminar grupo"}
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
                
                <div className="px-5 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC]">
                    <p className="text-xs text-[#94A3B8]">
                        {isPending ? 'Actualizando…' : `Mostrando ${grupos.length} grupos registrados`}
                    </p>
                </div>
            </div>

            {/* ── Modal Nuevo Grupo ── */}
            <Dialog open={modalCrearAbierto} onOpenChange={(open) => !guardando && setModalCrearAbierto(open)}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold text-[#0F172A]">Nuevo Grupo</DialogTitle>
                    </DialogHeader>

                    {errorGlobal && modalCrearAbierto && (
                        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mt-2">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {errorGlobal}
                        </div>
                    )}

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[#334155]">
                                Nombre del grupo <span className="text-red-500">*</span>
                            </label>
                            <Input 
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                placeholder="Ej: Equipo Quito"
                                disabled={guardando}
                                className="border-[#E2E8F0] focus-visible:ring-[#1E40AF]"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[#334155]">
                                Descripción <span className="text-[#94A3B8] font-normal">(Opcional)</span>
                            </label>
                            <Textarea 
                                value={descripcion}
                                onChange={(e) => setDescripcion(e.target.value)}
                                placeholder="Propósito o área de cobertura del grupo..."
                                disabled={guardando}
                                rows={3}
                                className="border-[#E2E8F0] focus-visible:ring-[#1E40AF]"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[#334155]">
                                Responsable <span className="text-[#94A3B8] font-normal">(Opcional)</span>
                            </label>
                            <Select value={responsableId} onValueChange={setResponsableId} disabled={guardando}>
                                <SelectTrigger className="border-[#E2E8F0] focus:ring-[#1E40AF]">
                                    <SelectValue placeholder="Seleccionar responsable..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="sin_asignar">Sin responsable</SelectItem>
                                    {usuariosActivos.map(u => (
                                        <SelectItem key={u.id} value={u.id}>
                                            {u.nombre} {u.apellido}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setModalCrearAbierto(false)}
                            disabled={guardando}
                            className="text-[#64748B] hover:text-[#0F172A]"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleCrearGrupo}
                            disabled={guardando || !nombre.trim()}
                            className="bg-[#1E40AF] hover:bg-[#1E3A8A] text-white shadow-sm"
                        >
                            {guardando ? 'Creando...' : 'Crear grupo'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
