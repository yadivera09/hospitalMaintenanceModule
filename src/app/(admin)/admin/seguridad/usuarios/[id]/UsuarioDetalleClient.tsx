'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { 
    ArrowLeft, 
    Mail, 
    Phone, 
    CalendarDays, 
    ShieldCheck, 
    Shield, 
    Pencil, 
    KeyRound, 
    AlertCircle 
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { asignarRolesUsuario } from '@/app/actions/seguridad/usuarios'
import ResetPasswordButton from '@/components/seguridad/ResetPasswordButton'
import { usePuede } from '@/lib/seguridad/PermisosProvider'
import { MODULO, PERMISO } from '@/lib/seguridad/modulos'
import type { UsuarioDetalle } from '@/app/actions/seguridad/usuarios'
import type { RolConPermisos } from '@/app/actions/seguridad/roles'

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

export default function UsuarioDetalleClient({
    usuario,
    rolesCatalogo
}: {
    usuario: UsuarioDetalle
    rolesCatalogo: RolConPermisos[]
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    // Ocultar acciones no permitidas. La protección real está en las server
    // actions (requirePermiso); esto solo evita mostrar puertas cerradas.
    const puede = usePuede()
    const puedeEditar = puede(MODULO.USUARIOS, PERMISO.EDITAR)

    const [modalAbierto, setModalAbierto] = useState(false)
    const [rolesSeleccionados, setRolesSeleccionados] = useState<string[]>(usuario.roles.map(r => r.id))
    const [errorModal, setErrorModal] = useState<string | null>(null)
    /** Advertencia sobre la ficha de técnico tras guardar roles correctamente. */
    const [avisoPerfil, setAvisoPerfil] = useState<string | null>(null)
    const [guardando, setGuardando] = useState(false)

    const iniciales = `${usuario.nombre.charAt(0)}${usuario.apellido.charAt(0)}`.toUpperCase()
    const avatarColor = getAvatarColor(usuario.nombre)

    function handleAbrirModal() {
        setRolesSeleccionados(usuario.roles.map(r => r.id))
        setErrorModal(null)
        setModalAbierto(true)
    }

    function toggleRol(id: string) {
        setRolesSeleccionados(prev =>
            prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
        )
    }

    async function handleGuardarRoles() {
        if (rolesSeleccionados.length === 0) {
            setErrorModal('El usuario debe tener al menos un rol seleccionado.')
            return
        }

        setGuardando(true)
        setErrorModal(null)

        const result = await asignarRolesUsuario(usuario.id, rolesSeleccionados)

        setGuardando(false)

        // Los roles se guardaron si data llegó; un error acompañando a data es
        // una advertencia sobre la ficha de técnico, no un fallo del guardado.
        if (!result.data) {
            setErrorModal(result.error ?? 'No se pudieron guardar los roles.')
            return
        }

        setAvisoPerfil(result.error)
        setModalAbierto(false)
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
                    onClick={() => router.push('/admin/seguridad/usuarios')}
                >
                    <ArrowLeft className="h-4 w-4 mr-1.5" />
                    Usuarios
                </Button>
            </div>

            {avisoPerfil && (
                <div className="flex items-start gap-2 rounded-lg border border-aviso-linea bg-aviso-suave px-4 py-3">
                    <AlertCircle className="h-4 w-4 text-aviso-tinta shrink-0 mt-0.5" />
                    <p className="text-sm text-aviso-tinta">{avisoPerfil}</p>
                </div>
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 bg-panel p-6 rounded-xl border border-borde shadow-sm">
                <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-white text-2xl font-bold ${avatarColor}`}>
                    {iniciales}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-tinta">{usuario.nombre} {usuario.apellido}</h1>
                        <Badge variant="outline" className={`font-medium px-2 py-0.5 text-xs ${
                            usuario.activo 
                                ? 'border-ok-linea bg-ok-suave text-ok-tinta' 
                                : 'border-borde bg-panel-suave text-tinta-tenue'
                        }`}>
                            {usuario.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                    </div>
                    <p className="text-tinta-media text-sm mt-1">{usuario.email}</p>
                </div>
            </div>

            {/* ── Grid de Secciones ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* IZQUIERDA: Información (FichaFila pattern) */}
                <div className="bg-panel rounded-xl border border-borde shadow-sm overflow-hidden flex flex-col">
                    <div className="px-5 py-4 border-b border-borde bg-panel-suave">
                        <h2 className="text-base font-semibold text-tinta">Información</h2>
                    </div>
                    <div className="p-0">
                        <div className="flex items-center px-5 py-3 border-b border-borde last:border-0 hover:bg-panel-suave">
                            <Mail className="h-4 w-4 text-tinta-tenue shrink-0 mr-3" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-tinta-tenue font-medium uppercase tracking-wide">Email</p>
                                <p className="text-sm font-medium text-tinta truncate">{usuario.email}</p>
                            </div>
                        </div>

                        {usuario.telefono && (
                            <div className="flex items-center px-5 py-3 border-b border-borde last:border-0 hover:bg-panel-suave">
                                <Phone className="h-4 w-4 text-tinta-tenue shrink-0 mr-3" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-tinta-tenue font-medium uppercase tracking-wide">Teléfono</p>
                                    <p className="text-sm font-medium text-tinta">{usuario.telefono}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center px-5 py-3 border-b border-borde last:border-0 hover:bg-panel-suave">
                            <CalendarDays className="h-4 w-4 text-tinta-tenue shrink-0 mr-3" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-tinta-tenue font-medium uppercase tracking-wide">Miembro desde</p>
                                <p className="text-sm font-medium text-tinta">
                                    {new Date(usuario.created_at).toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: '2-digit' })}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center px-5 py-3 border-b border-borde last:border-0 hover:bg-panel-suave">
                            {usuario.mfa_configurado ? (
                                <ShieldCheck className="h-4 w-4 text-ok-tinta shrink-0 mr-3" />
                            ) : (
                                <Shield className="h-4 w-4 text-tinta-tenue shrink-0 mr-3" />
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-tinta-tenue font-medium uppercase tracking-wide">MFA</p>
                                {usuario.mfa_configurado ? (
                                    <p className="text-sm font-medium text-ok-tinta">Activo · {usuario.mfa_metodo}</p>
                                ) : (
                                    <p className="text-sm font-medium text-tinta-tenue">No configurado</p>
                                )}
                            </div>
                        </div>

                        {puedeEditar && (
                            <div className="px-5 py-3">
                                <ResetPasswordButton
                                    userId={usuario.user_id}
                                    nombre={`${usuario.nombre} ${usuario.apellido}`}
                                    className="w-full border-borde text-tinta-media hover:bg-panel-suave"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* DERECHA: Roles */}
                <div className="bg-panel rounded-xl border border-borde shadow-sm overflow-hidden flex flex-col">
                    <div className="px-5 py-4 border-b border-borde bg-panel-suave flex items-center justify-between">
                        <h2 className="text-base font-semibold text-tinta">Roles asignados</h2>
                        {puedeEditar && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleAbrirModal}
                                className="h-8 text-xs bg-panel text-marca-tinta border-borde hover:bg-marca-suave hover:text-marca-tinta hover:border-marca-linea shadow-sm"
                            >
                                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                                Editar roles
                            </Button>
                        )}
                    </div>
                    <div className="p-5 flex-1">
                        {usuario.roles.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center h-full">
                                <Shield className="h-8 w-8 text-borde mb-3" />
                                <p className="text-sm font-medium text-tinta-tenue">Sin roles asignados</p>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {usuario.roles.map(rol => (
                                    <Badge key={rol.id} variant="secondary" className="rounded-lg py-2 px-3 bg-panel-suave text-tinta border border-borde font-medium flex items-center gap-2">
                                        <KeyRound className="h-3.5 w-3.5 text-marca-tinta" />
                                        {rol.nombre}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                    {isPending && (
                        <div className="px-4 py-2 bg-marca-suave border-t border-marca-linea text-xs text-marca-tinta">
                            Actualizando datos...
                        </div>
                    )}
                </div>

            </div>

            {/* ── Modal Editar Roles ── */}
            <Dialog open={modalAbierto} onOpenChange={(open) => !guardando && setModalAbierto(open)}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold text-tinta">
                            Editar roles de {usuario.nombre}
                        </DialogTitle>
                    </DialogHeader>

                    {errorModal && (
                        <div className="flex items-center gap-2 rounded-lg border border-critico-linea bg-critico-suave px-4 py-3 text-sm text-critico-tinta mt-2">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {errorModal}
                        </div>
                    )}

                    <div className="flex flex-col gap-3 py-4 max-h-[60vh] overflow-y-auto pr-1">
                        {rolesCatalogo.map(rol => {
                            const isChecked = rolesSeleccionados.includes(rol.id);
                            return (
                                <label 
                                    key={rol.id} 
                                    className={`relative flex items-center p-4 gap-4 w-full rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                                        isChecked 
                                            ? 'bg-marca-suave border-marca' 
                                            : 'bg-panel border-borde hover:border-borde hover:bg-panel-suave'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => toggleRol(rol.id)}
                                        disabled={guardando}
                                        className="sr-only"
                                    />
                                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                                        isChecked ? 'bg-marca border-marca' : 'bg-panel border-borde'
                                    }`}>
                                        {isChecked && <ShieldCheck className="h-3 w-3 text-white" />}
                                    </div>
                                    <div className="flex flex-col flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-sm font-semibold ${isChecked ? 'text-marca-tinta' : 'text-tinta'}`}>
                                                {rol.nombre}
                                            </span>
                                            {rol.es_sistema && (
                                                <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-panel-suave border-borde text-tinta-media font-medium">Sistema</Badge>
                                            )}
                                        </div>
                                        {rol.descripcion && (
                                            <p className={`text-xs mt-0.5 ${isChecked ? 'text-marca-tinta' : 'text-tinta-media'}`}>
                                                {rol.descripcion}
                                            </p>
                                        )}
                                    </div>
                                </label>
                            )
                        })}
                    </div>

                    <DialogFooter className="border-t border-borde pt-4 mt-2">
                        <Button
                            variant="ghost"
                            onClick={() => setModalAbierto(false)}
                            disabled={guardando}
                            className="text-tinta-media hover:text-tinta hover:bg-panel-suave"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleGuardarRoles}
                            disabled={guardando}
                            className="bg-marca hover:bg-marca-fuerte text-white shadow-sm"
                        >
                            {guardando ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
