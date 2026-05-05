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
    const [modalAbierto, setModalAbierto] = useState(false)
    const [rolesSeleccionados, setRolesSeleccionados] = useState<string[]>(usuario.roles.map(r => r.id))
    const [errorModal, setErrorModal] = useState<string | null>(null)
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
        if (result.error) {
            setErrorModal(result.error)
            return
        }

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
                    className="h-8 text-[#64748B] hover:text-[#0F172A]"
                    onClick={() => router.push('/admin/seguridad/usuarios')}
                >
                    <ArrowLeft className="h-4 w-4 mr-1.5" />
                    Usuarios
                </Button>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-sm">
                <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-white text-2xl font-bold ${avatarColor}`}>
                    {iniciales}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-[#0F172A]">{usuario.nombre} {usuario.apellido}</h1>
                        <Badge variant="outline" className={`font-medium px-2 py-0.5 text-xs ${
                            usuario.activo 
                                ? 'border-green-200 bg-green-50 text-green-700' 
                                : 'border-[#E2E8F0] bg-[#F1F5F9] text-[#94A3B8]'
                        }`}>
                            {usuario.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                    </div>
                    <p className="text-[#64748B] text-sm mt-1">{usuario.email}</p>
                </div>
            </div>

            {/* ── Grid de Secciones ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* IZQUIERDA: Información (FichaFila pattern) */}
                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden flex flex-col">
                    <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                        <h2 className="text-base font-semibold text-[#0F172A]">Información</h2>
                    </div>
                    <div className="p-0">
                        <div className="flex items-center px-5 py-3 border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                            <Mail className="h-4 w-4 text-[#94A3B8] shrink-0 mr-3" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-[#94A3B8] font-medium uppercase tracking-wide">Email</p>
                                <p className="text-sm font-medium text-[#0F172A] truncate">{usuario.email}</p>
                            </div>
                        </div>

                        {usuario.telefono && (
                            <div className="flex items-center px-5 py-3 border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                                <Phone className="h-4 w-4 text-[#94A3B8] shrink-0 mr-3" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-[#94A3B8] font-medium uppercase tracking-wide">Teléfono</p>
                                    <p className="text-sm font-medium text-[#0F172A]">{usuario.telefono}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center px-5 py-3 border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                            <CalendarDays className="h-4 w-4 text-[#94A3B8] shrink-0 mr-3" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-[#94A3B8] font-medium uppercase tracking-wide">Miembro desde</p>
                                <p className="text-sm font-medium text-[#0F172A]">
                                    {new Date(usuario.created_at).toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: '2-digit' })}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center px-5 py-3 border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                            {usuario.mfa_configurado ? (
                                <ShieldCheck className="h-4 w-4 text-green-600 shrink-0 mr-3" />
                            ) : (
                                <Shield className="h-4 w-4 text-[#94A3B8] shrink-0 mr-3" />
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-[#94A3B8] font-medium uppercase tracking-wide">MFA</p>
                                {usuario.mfa_configurado ? (
                                    <p className="text-sm font-medium text-green-700">Activo · {usuario.mfa_metodo}</p>
                                ) : (
                                    <p className="text-sm font-medium text-[#94A3B8]">No configurado</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* DERECHA: Roles */}
                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden flex flex-col">
                    <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
                        <h2 className="text-base font-semibold text-[#0F172A]">Roles asignados</h2>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleAbrirModal}
                            className="h-8 text-xs bg-white text-[#1E40AF] border-[#E2E8F0] hover:bg-[#1E40AF]/5 hover:text-[#1E40AF] hover:border-[#1E40AF]/30 shadow-sm"
                        >
                            <Pencil className="h-3.5 w-3.5 mr-1.5" />
                            Editar roles
                        </Button>
                    </div>
                    <div className="p-5 flex-1">
                        {usuario.roles.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center h-full">
                                <Shield className="h-8 w-8 text-[#E2E8F0] mb-3" />
                                <p className="text-sm font-medium text-[#94A3B8]">Sin roles asignados</p>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {usuario.roles.map(rol => (
                                    <Badge key={rol.id} variant="secondary" className="rounded-lg py-2 px-3 bg-[#F8FAFC] text-[#0F172A] border border-[#E2E8F0] font-medium flex items-center gap-2">
                                        <KeyRound className="h-3.5 w-3.5 text-[#1E40AF]" />
                                        {rol.nombre}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                    {isPending && (
                        <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 text-xs text-blue-700">
                            Actualizando datos...
                        </div>
                    )}
                </div>

            </div>

            {/* ── Modal Editar Roles ── */}
            <Dialog open={modalAbierto} onOpenChange={(open) => !guardando && setModalAbierto(open)}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold text-[#0F172A]">
                            Editar roles de {usuario.nombre}
                        </DialogTitle>
                    </DialogHeader>

                    {errorModal && (
                        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mt-2">
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
                                            ? 'bg-[#1E40AF]/5 border-[#1E40AF]' 
                                            : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
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
                                        isChecked ? 'bg-[#1E40AF] border-[#1E40AF]' : 'bg-white border-[#CBD5E1]'
                                    }`}>
                                        {isChecked && <ShieldCheck className="h-3 w-3 text-white" />}
                                    </div>
                                    <div className="flex flex-col flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-sm font-semibold ${isChecked ? 'text-[#1E40AF]' : 'text-[#0F172A]'}`}>
                                                {rol.nombre}
                                            </span>
                                            {rol.es_sistema && (
                                                <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-slate-50 border-[#E2E8F0] text-[#64748B] font-medium">Sistema</Badge>
                                            )}
                                        </div>
                                        {rol.descripcion && (
                                            <p className={`text-xs mt-0.5 ${isChecked ? 'text-[#1E40AF]/80' : 'text-[#64748B]'}`}>
                                                {rol.descripcion}
                                            </p>
                                        )}
                                    </div>
                                </label>
                            )
                        })}
                    </div>

                    <DialogFooter className="border-t border-[#E2E8F0] pt-4 mt-2">
                        <Button
                            variant="ghost"
                            onClick={() => setModalAbierto(false)}
                            disabled={guardando}
                            className="text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleGuardarRoles}
                            disabled={guardando}
                            className="bg-[#1E40AF] hover:bg-[#1E3A8A] text-white shadow-sm"
                        >
                            {guardando ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
