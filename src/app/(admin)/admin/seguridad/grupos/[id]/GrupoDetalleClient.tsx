'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { 
    ArrowLeft, 
    UsersRound, 
    Pencil, 
    UserMinus, 
    Plus,
    AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { editarGrupo, agregarMiembro, removerMiembro } from '@/app/actions/seguridad/grupos'
import type { GrupoDetalle } from '@/app/actions/seguridad/grupos'
import type { UsuarioConRoles } from '@/app/actions/seguridad/usuarios'

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

export default function GrupoDetalleClient({
    grupo,
    usuariosActivos
}: {
    grupo: GrupoDetalle
    usuariosActivos: UsuarioConRoles[]
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    
    // Estados Modal Editar
    const [modalEditarAbierto, setModalEditarAbierto] = useState(false)
    const [nombre, setNombre] = useState(grupo.nombre)
    const [descripcion, setDescripcion] = useState(grupo.descripcion || '')
    const [responsableId, setResponsableId] = useState<string>(grupo.responsable_id || 'sin_asignar')
    const [guardando, setGuardando] = useState(false)
    const [errorModalEditar, setErrorModalEditar] = useState<string | null>(null)

    // Estados Modal Miembro
    const [modalMiembroAbierto, setModalMiembroAbierto] = useState(false)
    const [miembroSeleccionado, setMiembroSeleccionado] = useState<string>('')
    const [agregando, setAgregando] = useState(false)
    const [errorModalMiembro, setErrorModalMiembro] = useState<string | null>(null)

    // Filtro para usuarios que no están en el grupo
    const miembrosIds = new Set(grupo.miembros.map(m => m.usuario_id))
    const usuariosDisponibles = usuariosActivos.filter(u => !miembrosIds.has(u.id))

    // ── Handlers Editar ──
    function handleAbrirEditar() {
        setNombre(grupo.nombre)
        setDescripcion(grupo.descripcion || '')
        setResponsableId(grupo.responsable_id || 'sin_asignar')
        setErrorModalEditar(null)
        setModalEditarAbierto(true)
    }

    async function handleEditarGrupo() {
        if (!nombre.trim()) {
            setErrorModalEditar('El nombre del grupo es obligatorio.')
            return
        }

        setGuardando(true)
        setErrorModalEditar(null)

        const result = await editarGrupo(grupo.id, {
            nombre,
            descripcion: descripcion.trim() || null,
            responsable_id: responsableId === 'sin_asignar' ? null : responsableId
        })

        if (result.error) {
            setErrorModalEditar(result.error)
            setGuardando(false)
            return
        }

        setModalEditarAbierto(false)
        startTransition(() => {
            router.refresh()
            setGuardando(false)
        })
    }

    // ── Handlers Miembros ──
    function handleAbrirAgregarMiembro() {
        setMiembroSeleccionado('')
        setErrorModalMiembro(null)
        setModalMiembroAbierto(true)
    }

    async function handleAgregarMiembro() {
        if (!miembroSeleccionado) {
            setErrorModalMiembro('Selecciona un usuario.')
            return
        }

        setAgregando(true)
        setErrorModalMiembro(null)

        const result = await agregarMiembro(grupo.id, miembroSeleccionado)

        if (result.error) {
            setErrorModalMiembro(result.error)
            setAgregando(false)
            return
        }

        setModalMiembroAbierto(false)
        startTransition(() => {
            router.refresh()
            setAgregando(false)
        })
    }

    async function handleQuitarMiembro(usuarioId: string) {
        if (!confirm('¿Estás seguro de quitar a este miembro del grupo?')) return

        const result = await removerMiembro(grupo.id, usuarioId)
        if (result.error) {
            alert(result.error)
            return
        }

        startTransition(() => {
            router.refresh()
        })
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-10">
            {/* ── Encabezado ── */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-tinta-media hover:text-tinta"
                    onClick={() => router.push('/admin/seguridad/grupos')}
                >
                    <ArrowLeft className="h-4 w-4 mr-1.5" />
                    Grupos
                </Button>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 bg-panel p-6 rounded-xl border border-borde shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-marca-suave">
                        <UsersRound className="h-6 w-6 text-marca-tinta" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-tinta">{grupo.nombre}</h1>
                            <Badge variant="outline" className={`font-medium px-2 py-0.5 text-xs ${
                                grupo.activo 
                                    ? 'border-ok-linea bg-ok-suave text-ok-tinta' 
                                    : 'border-borde bg-panel-suave text-tinta-tenue'
                            }`}>
                                {grupo.activo ? 'Activo' : 'Inactivo'}
                            </Badge>
                        </div>
                        {grupo.descripcion && (
                            <p className="text-tinta-media text-sm mt-1">{grupo.descripcion}</p>
                        )}
                        <p className="text-xs text-tinta-tenue mt-1 font-medium">
                            Responsable: <span className="text-tinta-media font-semibold">{grupo.responsable_nombre || 'Sin responsable'}</span>
                        </p>
                    </div>
                </div>
                <Button 
                    variant="outline" 
                    onClick={handleAbrirEditar}
                    className="shrink-0 border-borde text-tinta hover:bg-panel-suave"
                >
                    <Pencil className="h-4 w-4 mr-2 text-tinta-media" />
                    Editar grupo
                </Button>
            </div>

            {/* ── Miembros ── */}
            <div className="bg-panel rounded-xl border border-borde shadow-sm overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 border-b border-borde bg-panel-suave gap-3">
                    <h2 className="text-base font-semibold text-tinta flex items-center gap-2">
                        <UsersRound className="h-4 w-4 text-tinta-media" />
                        Miembros del grupo
                        <Badge variant="secondary" className="ml-1 bg-panel text-tinta-media border-borde">{grupo.total_miembros}</Badge>
                    </h2>
                    <Button 
                        size="sm" 
                        onClick={handleAbrirAgregarMiembro}
                        className="h-8 text-xs bg-marca hover:bg-marca-fuerte text-white shadow-sm shrink-0"
                    >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Agregar miembro
                    </Button>
                </div>
                
                <div className="p-0">
                    {grupo.miembros.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <UsersRound className="h-10 w-10 text-borde mb-3" />
                            <p className="text-sm font-medium text-tinta-media">Este grupo no tiene miembros</p>
                            <p className="text-xs text-tinta-tenue mt-1">Agrega usuarios para que pertenezcan al grupo.</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-borde">
                            {grupo.miembros.map(miembro => {
                                const iniciales = `${miembro.nombre.charAt(0)}${miembro.apellido.charAt(0)}`.toUpperCase()
                                const avatarColor = getAvatarColor(miembro.nombre)
                                return (
                                    <li key={miembro.usuario_id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 py-3 hover:bg-panel-suave transition-colors gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white font-bold text-xs ${avatarColor}`}>
                                                {iniciales}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-sm font-semibold text-tinta truncate">
                                                    {miembro.nombre} {miembro.apellido}
                                                </span>
                                                <span className="text-xs text-tinta-media truncate">
                                                    {miembro.email}
                                                </span>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleQuitarMiembro(miembro.usuario_id)}
                                            className="h-8 px-2 text-xs text-critico-tinta hover:text-critico-tinta hover:bg-critico-suave self-end sm:self-auto shrink-0"
                                        >
                                            <UserMinus className="h-3.5 w-3.5 mr-1.5" />
                                            Quitar
                                        </Button>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>
                {isPending && (
                    <div className="px-5 py-2 bg-marca-suave border-t border-marca-linea text-xs text-marca-tinta">
                        Actualizando lista...
                    </div>
                )}
            </div>

            {/* ── Modal Editar Grupo ── */}
            <Dialog open={modalEditarAbierto} onOpenChange={(open) => !guardando && setModalEditarAbierto(open)}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold text-tinta">Editar Grupo</DialogTitle>
                    </DialogHeader>

                    {errorModalEditar && (
                        <div className="flex items-center gap-2 rounded-lg border border-critico-linea bg-critico-suave px-4 py-3 text-sm text-critico-tinta mt-2">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {errorModalEditar}
                        </div>
                    )}

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-tinta-media">
                                Nombre del grupo <span className="text-critico-tinta">*</span>
                            </label>
                            <Input 
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                disabled={guardando}
                                className="border-borde focus-visible:ring-marca"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-tinta-media">
                                Descripción <span className="text-tinta-tenue font-normal">(Opcional)</span>
                            </label>
                            <Textarea 
                                value={descripcion}
                                onChange={(e) => setDescripcion(e.target.value)}
                                disabled={guardando}
                                rows={3}
                                className="border-borde focus-visible:ring-marca"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-tinta-media">
                                Responsable <span className="text-tinta-tenue font-normal">(Opcional)</span>
                            </label>
                            <Select value={responsableId} onValueChange={setResponsableId} disabled={guardando}>
                                <SelectTrigger className="border-borde focus:ring-marca">
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
                            onClick={() => setModalEditarAbierto(false)}
                            disabled={guardando}
                            className="text-tinta-media hover:text-tinta"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleEditarGrupo}
                            disabled={guardando || !nombre.trim()}
                            className="bg-marca hover:bg-marca-fuerte text-white shadow-sm"
                        >
                            {guardando ? 'Guardando...' : 'Guardar cambios'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Modal Agregar Miembro ── */}
            <Dialog open={modalMiembroAbierto} onOpenChange={(open) => !agregando && setModalMiembroAbierto(open)}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold text-tinta">Agregar miembro</DialogTitle>
                    </DialogHeader>

                    {errorModalMiembro && (
                        <div className="flex items-center gap-2 rounded-lg border border-critico-linea bg-critico-suave px-4 py-3 text-sm text-critico-tinta mt-2">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {errorModalMiembro}
                        </div>
                    )}

                    <div className="space-y-4 py-4">
                        {usuariosDisponibles.length === 0 ? (
                            <div className="p-4 bg-panel-suave border border-borde rounded-lg text-center text-sm text-tinta-media">
                                Todos los usuarios activos ya son miembros del grupo.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-tinta-media">
                                    Usuario <span className="text-critico-tinta">*</span>
                                </label>
                                <Select value={miembroSeleccionado} onValueChange={setMiembroSeleccionado} disabled={agregando}>
                                    <SelectTrigger className="border-borde focus:ring-marca">
                                        <SelectValue placeholder="Seleccionar un usuario..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {usuariosDisponibles.map(u => (
                                            <SelectItem key={u.id} value={u.id}>
                                                {u.nombre} {u.apellido} ({u.email})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setModalMiembroAbierto(false)}
                            disabled={agregando}
                            className="text-tinta-media hover:text-tinta"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleAgregarMiembro}
                            disabled={agregando || !miembroSeleccionado || usuariosDisponibles.length === 0}
                            className="bg-marca hover:bg-marca-fuerte text-white shadow-sm"
                        >
                            {agregando ? 'Agregando...' : 'Agregar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
