'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowLeft, User2, Mail, Phone, CalendarDays,
    Pencil, AlertCircle, CheckCircle2, XCircle,
    ShieldCheck, ShieldOff, RotateCcw, Smartphone, Mail as MailIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import TecnicoForm from '@/components/admin/tecnicos/TecnicoForm'
import { updateTecnico } from '@/app/actions/tecnicos'
import { resetMfaTecnico } from '@/app/actions/mfa'
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
    en_progreso: { icon: AlertCircle, label: 'En progreso', cls: 'text-indigo-600' },
    pendiente_firma_cliente: { icon: AlertCircle, label: 'Pte. firma cliente', cls: 'text-amber-600' },
    cerrado: { icon: CheckCircle2, label: 'Cerrado', cls: 'text-green-600' },
    anulado: { icon: XCircle, label: 'Anulado', cls: 'text-red-500' },
}

export default function TecnicoDetalleClient({ tecnicoInicial, errorInicial }: Props) {
    const router = useRouter()
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
                <User2 className="h-12 w-12 text-[#E2E8F0] mb-4" />
                <h2 className="text-lg font-bold text-[#0F172A]">Técnico no encontrado</h2>
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
        const { error } = await resetMfaTecnico(tecnico.id, tecnico.user_id)
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
                className="gap-1.5 text-[#94A3B8] hover:text-[#334155] -ml-2 px-2">
                <ArrowLeft className="h-4 w-4" /> Técnicos
            </Button>

            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#1E40AF]/10">
                        <User2 className="h-7 w-7 text-[#1E40AF]" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold text-[#0F172A]">
                                {tecnico.nombre} {tecnico.apellido}
                            </h1>
                            <Badge className={`text-xs ${tecnico.activo ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                {tecnico.activo ? 'Activo' : 'Inactivo'}
                            </Badge>
                        </div>
                        <p className="text-sm text-[#94A3B8] mt-0.5">{tecnico.cedula ?? 'Sin cédula'}</p>
                    </div>
                </div>
                <Button onClick={() => setModal(true)} className="bg-[#1E40AF] hover:bg-[#1E3A8A] text-white gap-2">
                    <Pencil className="h-4 w-4" /> Editar
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm space-y-4">
                    <h2 className="text-sm font-semibold text-[#0F172A] border-b border-[#E2E8F0] pb-2">Datos personales</h2>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <Mail className="h-4 w-4 text-[#94A3B8]" />
                            <div><p className="text-xs text-[#94A3B8]">Email</p><p className="text-sm text-[#334155]">{tecnico.email}</p></div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Phone className="h-4 w-4 text-[#94A3B8]" />
                            <div><p className="text-xs text-[#94A3B8]">Teléfono</p><p className="text-sm text-[#334155]">{tecnico.telefono || '—'}</p></div>
                        </div>
                        <div className="flex items-center gap-3">
                            <CalendarDays className="h-4 w-4 text-[#94A3B8]" />
                            <div><p className="text-xs text-[#94A3B8]">Registrado</p><p className="text-sm text-[#334155]">{formatFecha(tecnico.created_at)}</p></div>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-[#0F172A]">Últimas intervenciones</h2>
                        <span className="text-xs text-[#94A3B8] bg-[#F1F5F9] px-2 py-0.5 rounded-full">{intervenciones.length} de 5</span>
                    </div>
                    {intervenciones.length === 0 ? (
                        <p className="text-sm text-[#94A3B8] py-8 text-center bg-[#F8FAFC] rounded-lg">Sin intervenciones recientes</p>
                    ) : (
                        <div className="space-y-3">
                            {intervenciones.map((iv) => {
                                const rc = ESTADO_REPORTE_CONFIG[iv.estado_reporte] || ESTADO_REPORTE_CONFIG.en_progreso
                                const RC = rc.icon
                                const nombreCliente = Array.isArray(iv.contrato) ? iv.contrato[0]?.cliente?.razon_social : iv.contrato?.cliente?.razon_social
                                return (
                                    <div key={iv.id} className="flex items-start justify-between gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono font-semibold text-[#1E40AF]">{iv.equipo?.codigo_mh ?? 'N/A'}</span>
                                                <span className="text-xs bg-[#E2E8F0] text-[#334155] px-1.5 py-0.5 rounded-sm">{iv.tipo?.nombre ?? 'Mantenimiento'}</span>
                                            </div>
                                            <p className="text-sm text-[#334155] mt-0.5 truncate">{iv.equipo?.nombre ?? 'Equipo'}</p>
                                            <p className="text-xs text-[#94A3B8]">{nombreCliente ?? 'Cliente'} · {formatFecha(iv.fecha_inicio)}</p>
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
                </div>
            </div>

            {/* ── Sección Seguridad ── */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-[#0F172A]">Seguridad</h2>
                    {tecnico.mfa_configurado && tecnico.user_id && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setResetError(null); setModalReset(true) }}
                            className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700 text-xs"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Restablecer MFA
                        </Button>
                    )}
                </div>

                <div className="space-y-3">
                    {/* Estado MFA */}
                    <div className="flex items-center gap-3">
                        {tecnico.mfa_configurado
                            ? <ShieldCheck className="h-4 w-4 text-green-500 shrink-0" />
                            : <ShieldOff className="h-4 w-4 text-[#94A3B8] shrink-0" />
                        }
                        <div className="flex items-center gap-2">
                            <p className="text-xs text-[#94A3B8]">Estado MFA</p>
                            <Badge className={`text-xs ${
                                tecnico.mfa_configurado
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>
                                {tecnico.mfa_configurado ? 'Configurado' : 'No configurado'}
                            </Badge>
                        </div>
                    </div>

                    {/* Método */}
                    <div className="flex items-center gap-3">
                        {tecnico.mfa_metodo === 'totp'
                            ? <Smartphone className="h-4 w-4 text-[#94A3B8] shrink-0" />
                            : <MailIcon className="h-4 w-4 text-[#94A3B8] shrink-0" />
                        }
                        <div>
                            <p className="text-xs text-[#94A3B8]">Método</p>
                            <p className="text-sm text-[#334155]">
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
                        <CalendarDays className="h-4 w-4 text-[#94A3B8] shrink-0" />
                        <div>
                            <p className="text-xs text-[#94A3B8]">Configurado el</p>
                            <p className="text-sm text-[#334155]">{formatFecha(tecnico.mfa_configurado_en)}</p>
                        </div>
                    </div>

                    {/* Aviso si no tiene user_id (no puede acceder al sistema aún) */}
                    {!tecnico.user_id && (
                        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1">
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
                            <RotateCcw className="h-5 w-5 text-amber-500" />
                            Restablecer MFA
                        </DialogTitle>
                        <DialogDescription>
                            Esta acción eliminará la configuración de segundo factor de{' '}
                            <span className="font-semibold text-[#334155]">
                                {tecnico.nombre} {tecnico.apellido}
                            </span>.
                            El técnico deberá configurar MFA nuevamente en su próximo inicio de sesión.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mt-1">
                        <p className="text-sm text-amber-700">
                            Si el técnico tiene una sesión activa, quedará bloqueado hasta completar
                            la configuración de MFA.
                        </p>
                    </div>

                    {resetError && (
                        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-600">{resetError}</p>
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
