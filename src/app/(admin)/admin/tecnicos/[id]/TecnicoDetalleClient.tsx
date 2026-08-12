'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowLeft, User2, Mail, Phone, CalendarDays,
    Pencil, AlertCircle, CheckCircle2, XCircle,
    ShieldCheck, ShieldOff, RotateCcw, Smartphone, Mail as MailIcon,
    ArrowRight
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import TecnicoForm from '@/components/admin/tecnicos/TecnicoForm'
import { updateTecnico } from '@/app/actions/tecnicos'
import { resetMfaUsuario } from '@/app/actions/mfa'
import ResetPasswordButton from '@/components/seguridad/ResetPasswordButton'
import { usePuede } from '@/lib/seguridad/PermisosProvider'
import { MODULO, PERMISO } from '@/lib/seguridad/modulos'
import type { Tecnico } from '@/types'
import type { TecnicoFormValues } from '@/components/admin/tecnicos/TecnicoForm'

type IntervencionDB = {
    id: string
    estado_reporte: string
    fecha_inicio: string
    fecha_fin: string | null
    tipo: { nombre: string } | null
    equipo: { codigo_mh: string; nombre: string; marca: string | null; modelo: string | null } | null
    contrato?: { cliente: { razon_social: string } | null } | null
}

interface Props {
    tecnicoInicial: (Tecnico & { intervenciones: IntervencionDB[] }) | undefined
    errorInicial: string | null
}

function formatFecha(f: string | null) {
    if (!f) return '—'
    return new Date(f).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })
}

const ESTADO_REPORTE_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; cls: string }> = {
    en_progreso: { icon: AlertCircle, label: 'En progreso', cls: 'text-marca-tinta' },
    cerrado: { icon: CheckCircle2, label: 'Cerrado', cls: 'text-ok-tinta' },
    anulado: { icon: XCircle, label: 'Anulado', cls: 'text-critico-tinta' },
}

export default function TecnicoDetalleClient({ tecnicoInicial, errorInicial }: Props) {
    const router = useRouter()

    // Antes del return temprano de más abajo: los hooks deben ejecutarse
    // siempre en el mismo orden, sin condicionales de por medio.
    const puede = usePuede()
    const puedeEditar = puede(MODULO.TECNICOS, PERMISO.EDITAR)

    const [tecnico, setTecnico] = useState(tecnicoInicial)
    const [modal, setModal] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // MFA reset
    const [modalReset, setModalReset] = useState(false)
    const [isResetting, setIsResetting] = useState(false)
    const [resetError, setResetError] = useState<string | null>(null)

    if (errorInicial || !tecnico) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <User2 className="h-12 w-12 text-borde mb-4" />
                <h2 className="text-lg font-bold text-tinta">Técnico no encontrado</h2>
                <Button variant="outline" className="mt-6" onClick={() => router.push('/admin/tecnicos')}>
                    Volver a Técnicos
                </Button>
            </div>
        )
    }

    const intervenciones = tecnico.intervenciones ?? []

    async function handleResetMfa() {
        if (!tecnico?.user_id) return
        setIsResetting(true)
        setResetError(null)
        const { error } = await resetMfaUsuario(tecnico.user_id)
        setIsResetting(false)
        if (error) {
            setResetError(error)
            return
        }
        // Actualizar estado local para reflejar el reset inmediatamente
        setTecnico((prev) => prev ? {
            ...prev,
            mfa_configurado: false,
            mfa_metodo: null,
            mfa_configurado_en: null,
            mfa_sesion_verificada: false,
        } : prev)
        setModalReset(false)
    }

    async function handleGuardar(v: TecnicoFormValues) {
        setIsSaving(true)
        const payload = {
            nombre: v.nombre,
            apellido: v.apellido,
            cedula: v.cedula || null,
            email: v.email,
            telefono: v.telefono || null,
            activo: v.estado_display !== 'inactivo'
        }
        const { data, error } = await updateTecnico(tecnico!.id, payload)
        setIsSaving(false)
        if (!error && data) {
            setTecnico({ ...data, intervenciones: tecnico!.intervenciones })
            setModal(false)
            router.refresh()
        }
    }

    return (
        <div className="space-y-6 max-w-5xl">
            <Button variant="ghost" size="sm" onClick={() => router.push('/admin/tecnicos')}
                className="gap-1.5 text-tinta-tenue hover:text-tinta-media -ml-2 px-2">
                <ArrowLeft className="h-4 w-4" /> Técnicos
            </Button>

            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-marca-suave">
                        <User2 className="h-7 w-7 text-marca-tinta" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold text-tinta">
                                {tecnico.nombre} {tecnico.apellido}
                            </h1>
                            <Badge className={`text-xs ${tecnico.activo ? 'bg-ok-suave text-ok-tinta border-ok-linea' : 'bg-critico-suave text-critico-tinta border-critico-linea'}`}>
                                {tecnico.activo ? 'Activo' : 'Inactivo'}
                            </Badge>
                        </div>
                        <p className="text-sm text-tinta-tenue mt-0.5">{tecnico.cedula ?? 'Sin cédula'}</p>
                    </div>
                </div>
                {puedeEditar && (
                    <Button onClick={() => setModal(true)} className="bg-marca hover:bg-marca-fuerte text-white gap-2">
                        <Pencil className="h-4 w-4" /> Editar
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-borde bg-panel p-5 shadow-sm space-y-4">
                    <h2 className="text-sm font-semibold text-tinta border-b border-borde pb-2">Datos personales</h2>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <Mail className="h-4 w-4 text-tinta-tenue" />
                            <div><p className="text-xs text-tinta-tenue">Email</p><p className="text-sm text-tinta-media">{tecnico.email}</p></div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Phone className="h-4 w-4 text-tinta-tenue" />
                            <div><p className="text-xs text-tinta-tenue">Teléfono</p><p className="text-sm text-tinta-media">{tecnico.telefono || '—'}</p></div>
                        </div>
                        <div className="flex items-center gap-3">
                            <CalendarDays className="h-4 w-4 text-tinta-tenue" />
                            <div><p className="text-xs text-tinta-tenue">Registrado</p><p className="text-sm text-tinta-media">{formatFecha(tecnico.created_at)}</p></div>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-borde bg-panel p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-tinta">Últimas intervenciones</h2>
                        <span className="text-xs text-tinta-tenue bg-panel-suave px-2 py-0.5 rounded-full">{intervenciones.length} de 5</span>
                    </div>
                    {intervenciones.length === 0 ? (
                        <p className="text-sm text-tinta-tenue py-8 text-center bg-panel-suave rounded-lg">Sin intervenciones recientes</p>
                    ) : (
                        <div className="space-y-3">
                            {intervenciones.map((iv) => {
                                const rc = ESTADO_REPORTE_CONFIG[iv.estado_reporte] || ESTADO_REPORTE_CONFIG.en_progreso
                                const RC = rc.icon
                                const nombreCliente = Array.isArray(iv.contrato) ? iv.contrato[0]?.cliente?.razon_social : iv.contrato?.cliente?.razon_social
                                return (
                                    <div key={iv.id} className="flex items-start justify-between gap-3 rounded-lg border border-borde bg-panel-suave px-3.5 py-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono font-semibold text-marca-tinta">{iv.equipo?.codigo_mh ?? 'N/A'}</span>
                                                <span className="text-xs bg-borde text-tinta-media px-1.5 py-0.5 rounded-sm">{iv.tipo?.nombre ?? 'Mantenimiento'}</span>
                                            </div>
                                            <p className="text-sm text-tinta-media mt-0.5 truncate">{iv.equipo?.nombre ?? 'Equipo'}</p>
                                            <p className="text-xs text-tinta-tenue">{nombreCliente ?? 'Cliente'} · {formatFecha(iv.fecha_inicio)}</p>
                                        </div>
                                        <div className="shrink-0 flex items-center gap-1">
                                            <RC className={`h-3.5 w-3.5 ${rc.cls}`} />
                                            <span className={`text-xs font-medium ${rc.cls}`}>{rc.label}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-borde">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => router.push(`/admin/reportes?tecnico_id=${tecnico.id}`)}
                            className="w-full text-marca-tinta hover:bg-marca-suave text-xs gap-2"
                        >
                            Ver historial completo de reportes
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── Sección Seguridad ── */}
            <div className="rounded-xl border border-borde bg-panel p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4 gap-2">
                    <h2 className="text-sm font-semibold text-tinta">Seguridad</h2>
                    <div className="flex items-center gap-2">
                        {/* Resetear credenciales y MFA son intervenciones sobre la
                            cuenta de otra persona: exigen permiso de edición. */}
                        {puedeEditar && tecnico.user_id && (
                            <ResetPasswordButton
                                userId={tecnico.user_id}
                                nombre={`${tecnico.nombre} ${tecnico.apellido}`}
                                className="border-borde text-tinta-media hover:bg-panel-suave text-xs"
                            />
                        )}
                        {puedeEditar && tecnico.mfa_configurado && tecnico.user_id && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { setResetError(null); setModalReset(true) }}
                                className="gap-1.5 text-aviso-tinta border-aviso-linea hover:bg-aviso-suave hover:text-aviso-tinta text-xs"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Restablecer MFA
                            </Button>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    {/* Estado MFA */}
                    <div className="flex items-center gap-3">
                        {tecnico.mfa_configurado
                            ? <ShieldCheck className="h-4 w-4 text-ok-tinta shrink-0" />
                            : <ShieldOff className="h-4 w-4 text-tinta-tenue shrink-0" />
                        }
                        <div className="flex items-center gap-2">
                            <p className="text-xs text-tinta-tenue">Estado MFA</p>
                            <Badge className={`text-xs ${
                                tecnico.mfa_configurado
                                    ? 'bg-ok-suave text-ok-tinta border-ok-linea'
                                    : 'bg-panel-suave text-tinta-tenue border-borde'
                            }`}>
                                {tecnico.mfa_configurado ? 'Configurado' : 'No configurado'}
                            </Badge>
                        </div>
                    </div>

                    {/* Método */}
                    <div className="flex items-center gap-3">
                        {tecnico.mfa_metodo === 'totp'
                            ? <Smartphone className="h-4 w-4 text-tinta-tenue shrink-0" />
                            : <MailIcon className="h-4 w-4 text-tinta-tenue shrink-0" />
                        }
                        <div>
                            <p className="text-xs text-tinta-tenue">Método</p>
                            <p className="text-sm text-tinta-media">
                                {tecnico.mfa_metodo === 'totp'
                                    ? 'App autenticadora (TOTP)'
                                    : tecnico.mfa_metodo === 'email'
                                    ? 'Correo electrónico'
                                    : '—'
                                }
                            </p>
                        </div>
                    </div>

                    {/* Fecha de configuración */}
                    <div className="flex items-center gap-3">
                        <CalendarDays className="h-4 w-4 text-tinta-tenue shrink-0" />
                        <div>
                            <p className="text-xs text-tinta-tenue">Configurado el</p>
                            <p className="text-sm text-tinta-media">{formatFecha(tecnico.mfa_configurado_en)}</p>
                        </div>
                    </div>

                    {/* Aviso si no tiene user_id (no puede acceder al sistema aún) */}
                    {!tecnico.user_id && (
                        <p className="text-xs text-aviso-tinta bg-aviso-suave border border-aviso-linea rounded-lg px-3 py-2 mt-1">
                            Este técnico no tiene cuenta de acceso al sistema todavía.
                        </p>
                    )}
                </div>
            </div>

            {/* ── Dialog: confirmar reset MFA ── */}
            <Dialog open={modalReset} onOpenChange={setModalReset}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <RotateCcw className="h-5 w-5 text-aviso-tinta" />
                            Restablecer MFA
                        </DialogTitle>
                        <DialogDescription>
                            Esta acción eliminará la configuración de segundo factor de{' '}
                            <span className="font-semibold text-tinta-media">
                                {tecnico.nombre} {tecnico.apellido}
                            </span>.
                            El técnico deberá configurar MFA nuevamente en su próximo inicio de sesión.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-lg border border-aviso-linea bg-aviso-suave px-4 py-3 mt-1">
                        <p className="text-sm text-aviso-tinta">
                            Si el técnico tiene una sesión activa, quedará bloqueado hasta completar
                            la configuración de MFA.
                        </p>
                    </div>

                    {resetError && (
                        <div className="flex items-start gap-2 rounded-lg border border-critico-linea bg-critico-suave px-3 py-2.5">
                            <AlertCircle className="h-4 w-4 text-critico-tinta shrink-0 mt-0.5" />
                            <p className="text-sm text-critico-tinta">{resetError}</p>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 mt-2">
                        <Button
                            variant="outline"
                            onClick={() => setModalReset(false)}
                            disabled={isResetting}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleResetMfa}
                            disabled={isResetting}
                            className="bg-amber-500 hover:bg-amber-600 text-white gap-2"
                        >
                            {isResetting
                                ? <><span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Restableciendo…</>
                                : <><RotateCcw className="h-4 w-4" />Confirmar reset</>
                            }
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={modal} onOpenChange={setModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Técnico</DialogTitle>
                        <DialogDescription>Modifica los datos del técnico.</DialogDescription>
                    </DialogHeader>
                    <TecnicoForm modo="editar" tecnicoInicial={tecnico} isLoading={isSaving}
                        onGuardar={handleGuardar} onCancelar={() => setModal(false)} />
                </DialogContent>
            </Dialog>
        </div>
    )
}
