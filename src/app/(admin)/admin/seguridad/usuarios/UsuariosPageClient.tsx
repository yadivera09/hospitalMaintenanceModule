'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Users,
    Search,
    ShieldCheck,
    Shield,
    Eye,
    AlertCircle,
    UserCheck,
    UserX,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toggleUsuarioActivo } from '@/app/actions/seguridad/usuarios'
import type { UsuarioConRoles } from '@/app/actions/seguridad/usuarios'
import type { RolConPermisos } from '@/app/actions/seguridad/roles'
import NuevoUsuarioModal from './NuevoUsuarioModal'

// Colores específicos solicitados
const AVATAR_COLORS = [
    'bg-blue-500',
    'bg-violet-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-cyan-500'
]

function getAvatarColor(nombre: string) {
    if (!nombre) return AVATAR_COLORS[0]
    const charCode = nombre.charCodeAt(0)
    return AVATAR_COLORS[charCode % 6]
}

interface Props {
    usuariosIniciales: UsuarioConRoles[]
    rolesCatalogo: RolConPermisos[]
    errorInicial: string | null
}

export default function UsuariosPageClient({ usuariosIniciales, rolesCatalogo, errorInicial }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    // ── Estado ────────────────────────────────────────────────────────────────
    const [usuarios, setUsuarios] = useState<UsuarioConRoles[]>(usuariosIniciales)
    
    // Sincronizar estado local con props del servidor tras router.refresh()
    useEffect(() => {
        setUsuarios(usuariosIniciales)
    }, [usuariosIniciales])
    const [busqueda, setBusqueda] = useState('')
    const [filtroRol, setFiltroRol] = useState<string>('todos')
    const [filtroEstado, setFiltroEstado] = useState<string>('todos')

    const [toggling, setToggling] = useState<string | null>(null)
    const [errorEliminar, setErrorEliminar] = useState<string | null>(null)

    // ── Filtros ───────────────────────────────────────────────────────────────
    const usuariosFiltrados = useMemo(() => {
        return usuarios.filter((u) => {
            const searchLower = busqueda.toLowerCase()
            const matchesBusqueda =
                u.nombre.toLowerCase().includes(searchLower) ||
                u.apellido.toLowerCase().includes(searchLower) ||
                u.email.toLowerCase().includes(searchLower)

            const matchesRol = filtroRol === 'todos' || u.roles.some((r) => r.id === filtroRol)
            const matchesEstado = 
                filtroEstado === 'todos' || 
                (filtroEstado === 'activos' && u.activo) || 
                (filtroEstado === 'inactivos' && !u.activo)

            return matchesBusqueda && matchesRol && matchesEstado
        })
    }, [usuarios, busqueda, filtroRol, filtroEstado])

    const totalActivos = usuarios.filter((u) => u.activo).length

    // ── Handlers ──────────────────────────────────────────────────────────────
    async function handleToggleEstado(usuarioId: string) {
        if (!confirm('¿Estás seguro de que deseas cambiar el estado de este usuario?')) return
        
        setToggling(usuarioId)
        setErrorEliminar(null)
        
        const result = await toggleUsuarioActivo(usuarioId)
        
        if (result.error) {
            setErrorEliminar(result.error)
            setToggling(null)
            return
        }

        // Actualización optimista local
        setUsuarios(prev => prev.map(u => u.id === usuarioId ? { ...u, activo: !u.activo } : u))
        setToggling(null)
        
        startTransition(() => {
            router.refresh()
        })
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* ── Encabezado ── */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E40AF]/10">
                        <Users className="h-5 w-5 text-[#1E40AF]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[#0F172A] leading-none">Usuarios</h1>
                        <p className="text-sm text-[#94A3B8] mt-0.5">
                            {usuarios.length} usuarios · {totalActivos} activos
                        </p>
                    </div>
                </div>

                <NuevoUsuarioModal
                    rolesCatalogo={rolesCatalogo}
                    onCreado={() => startTransition(() => router.refresh())}
                />
            </div>

            {errorInicial && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {errorInicial}
                </div>
            )}
            
            {errorEliminar && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {errorEliminar}
                </div>
            )}

            {/* ── Filtros ── */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o email..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        className="w-full rounded-md border border-[#E2E8F0] pl-9 pr-4 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#1E40AF] focus:outline-none focus:ring-1 focus:ring-[#1E40AF]"
                    />
                </div>
                
                <Select value={filtroRol} onValueChange={setFiltroRol}>
                    <SelectTrigger className="w-full sm:w-[200px] border-[#E2E8F0] text-[#0F172A]">
                        <SelectValue placeholder="Todos los roles" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos los roles</SelectItem>
                        {rolesCatalogo.map(rol => (
                            <SelectItem key={rol.id} value={rol.id}>{rol.nombre}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                    <SelectTrigger className="w-full sm:w-[160px] border-[#E2E8F0] text-[#0F172A]">
                        <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="activos">Activo</SelectItem>
                        <SelectItem value="inactivos">Inactivo</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* ── Tabla de usuarios ── */}
            <div className="rounded-xl bg-white border border-[#E2E8F0] shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-[#F8FAFC] hover:bg-[#F8FAFC]">
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 pl-5">
                                Usuario
                            </TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 hidden md:table-cell">
                                Rol(es)
                            </TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 hidden lg:table-cell text-center">
                                MFA
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
                        {usuariosFiltrados.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="py-16 text-center">
                                    <div className="flex flex-col items-center justify-center">
                                        <Users className="h-8 w-8 text-[#E2E8F0] mb-3" />
                                        <p className="text-sm font-medium text-[#64748B]">No se encontraron usuarios</p>
                                        <p className="text-xs text-[#94A3B8] mt-1">Intenta con otros términos de búsqueda.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            usuariosFiltrados.map((usuario) => {
                                const iniciales = `${usuario.nombre.charAt(0)}${usuario.apellido.charAt(0)}`.toUpperCase()
                                const avatarColor = getAvatarColor(usuario.nombre)
                                const mfaConfigurado = usuario.mfa_configurado === true
                                
                                return (
                                    <TableRow 
                                        key={usuario.id}
                                        className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors cursor-pointer group"
                                        onClick={() => router.push(`/admin/seguridad/usuarios/${usuario.id}`)}
                                    >
                                        {/* Usuario */}
                                        <TableCell className="py-3.5 pl-5">
                                            <div className="flex items-center gap-3">
                                                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white font-bold text-xs ${avatarColor}`}>
                                                    {iniciales}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-sm font-semibold text-[#0F172A] truncate">
                                                        {usuario.nombre} {usuario.apellido}
                                                    </span>
                                                    <span className="text-xs text-[#94A3B8] truncate">
                                                        {usuario.email}
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>

                                        {/* Rol(es) */}
                                        <TableCell className="py-3.5 hidden md:table-cell">
                                            <div className="flex flex-wrap gap-1">
                                                {usuario.roles.length === 0 ? (
                                                    <span className="text-xs text-[#94A3B8] italic">Sin roles</span>
                                                ) : (
                                                    usuario.roles.map(r => (
                                                        <Badge key={r.id} variant="secondary" className="bg-[#1E40AF]/10 text-[#1E40AF] hover:bg-[#1E40AF]/20 border-transparent text-[10px] py-0 px-2 font-medium rounded-sm">
                                                            {r.nombre}
                                                        </Badge>
                                                    ))
                                                )}
                                            </div>
                                        </TableCell>

                                        {/* MFA */}
                                        <TableCell className="py-3.5 hidden lg:table-cell text-center">
                                            <div className="flex justify-center">
                                                {mfaConfigurado ? (
                                                    <ShieldCheck className="h-4 w-4 text-green-600" aria-label="MFA configurado" />
                                                ) : (
                                                    <Shield className="h-4 w-4 text-[#94A3B8]" aria-label="MFA no configurado" />
                                                )}
                                            </div>
                                        </TableCell>

                                        {/* Estado */}
                                        <TableCell className="py-3.5">
                                            {usuario.activo ? (
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
                                                    onClick={() => router.push(`/admin/seguridad/usuarios/${usuario.id}`)}
                                                    className="h-8 w-8 p-0 text-[#94A3B8] hover:text-[#1E40AF] hover:bg-blue-50"
                                                    title="Editar usuario"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleToggleEstado(usuario.id)}
                                                    disabled={toggling === usuario.id}
                                                    className={`h-8 w-8 p-0 ${usuario.activo ? 'text-[#94A3B8] hover:text-red-600 hover:bg-red-50' : 'text-green-600 hover:text-green-700 hover:bg-green-50'}`}
                                                    title={usuario.activo ? 'Desactivar usuario' : 'Activar usuario'}
                                                >
                                                    {usuario.activo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
                
                <div className="px-5 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC]">
                    <p className="text-xs text-[#94A3B8]">
                        {isPending ? 'Actualizando…' : `Mostrando ${usuariosFiltrados.length} de ${usuarios.length} usuarios registrados`}
                    </p>
                </div>
            </div>
        </div>
    )
}
