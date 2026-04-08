'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowLeft, ClipboardList, AlertTriangle,
    CheckCircle2, XCircle, Wrench, Package,
    HardHat, ShieldCheck, Clock, MapPin,
    Tag, Building2, CheckSquare, AlertCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { ESTADO_REPORTE_CFG } from '@/components/admin/reportes/ReportesTable'
import { anularReporte } from '@/app/actions/reportes'
import type { EstadoReporte } from '@/types'

function formatFechaHora(iso: string) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('es-EC', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    })
}
function formatFecha(iso: string) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('es-EC', {
        day: '2-digit', month: 'long', year: 'numeric',
    })
}

function abreviarId(uuid: string) {
    if (!uuid) return ''
    const parts = uuid.split('-')
    return parts[parts.length - 1].slice(-6).toUpperCase()
}

function abreviarHash(hash: string) {
    if (!hash || hash.length < 12) return hash
    return `${hash.slice(0, 6)}...${hash.slice(-6)}`.toUpperCase()
}

const ESTADO_EQUIPO_POST: Record<string, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
    operativo: { label: 'Operativo', className: 'bg-green-50 text-green-700 border border-green-200', icon: CheckCircle2 },
    no_operativo: { label: 'No operativo', className: 'bg-red-50 text-red-600 border border-red-200', icon: XCircle },
    almacenado: { label: 'Almacenado', className: 'bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]', icon: Package },
    restringido: { label: 'Restringido', className: 'bg-amber-50 text-amber-700 border border-amber-200', icon: AlertTriangle },
    dado_de_baja: { label: 'Dado de baja', className: 'bg-red-100 text-red-900 border border-red-300', icon: XCircle },
}

function InfoCard({ children, title, icon: Icon }: { children: React.ReactNode; title: string; icon?: React.ComponentType<{ className?: string }> }) {
    return (
        <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
                {Icon && <Icon className="h-4 w-4 text-[#94A3B8]" />}
                <h2 className="text-sm font-semibold text-[#0F172A]">{title}</h2>
            </div>
            {children}
        </div>
    )
}

function FichaFila({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 py-2 border-b border-[#E2E8F0] last:border-0">
            <p className="text-xs text-[#94A3B8] w-28 shrink-0 mt-0.5">{label}</p>
            <div className="text-sm text-[#334155] font-medium flex-1">{children}</div>
        </div>
    )
}

function SeccionHeader({ reporte, onAnularClick }: { reporte: any; onAnularClick: () => void }) {
    const estadoCfg = ESTADO_REPORTE_CFG[reporte.estado_reporte as EstadoReporte] ?? {
        label: reporte.estado_reporte ?? '—',
        className: 'bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]',
    }
    const puedeAnular = reporte.estado_reporte === 'en_progreso' || reporte.estado_reporte === 'pendiente_firma_cliente'

    return (
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1E40AF]/10">
                        <ClipboardList className="h-6 w-6 text-[#1E40AF]" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-2xl font-bold font-mono tracking-widest text-[#0F172A]">
                                {reporte.numero_reporte_fisico ?? `#${abreviarId(reporte.id)}`}
                            </h1>
                            <Badge className={`text-xs font-semibold px-3 py-1 rounded-full ${estadoCfg.className}`}>
                                {estadoCfg.label}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-sm text-[#94A3B8]">{reporte.tipo?.nombre ?? 'Sin tipo'}</span>
                            <span className="text-[#E2E8F0]">·</span>
                            <span className="text-sm text-[#94A3B8]">{formatFechaHora(reporte.fecha_inicio)}</span>
                            <span className="text-[#E2E8F0]">·</span>
                            <span className="text-sm text-[#94A3B8]">{reporte.tecnico_principal?.nombre} {reporte.tecnico_principal?.apellido}</span>
                        </div>
                    </div>
                </div>
            </div>
            {puedeAnular && (
                <Button variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50 gap-2"
                    onClick={onAnularClick}>
                    <AlertTriangle className="h-4 w-4" />
                    Anular reporte
                </Button>
            )}
            {reporte.estado_reporte === 'anulado' && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <p className="text-xs text-red-700 font-medium">Reporte anulado</p>
                </div>
            )}
        </div>
    )
}

function SeccionEquipo({ reporte, router }: { reporte: any; router: any }) {
    return (
        <InfoCard title="Equipo intervenido" icon={Wrench}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
                <FichaFila label="Código MH">
                    <button onClick={() => router.push(`/admin/equipos/${reporte.equipo_id}`)}
                        className="font-mono font-bold text-[#1E40AF] hover:underline">
                        {reporte.equipo?.codigo_mh}
                    </button>
                </FichaFila>
                <FichaFila label="Equipo">{reporte.equipo?.nombre}</FichaFila>
                <FichaFila label="Marca / Modelo">
                    {reporte.equipo?.marca && reporte.equipo?.modelo
                        ? `${reporte.equipo.marca} · ${reporte.equipo.modelo}`
                        : reporte.equipo?.marca ?? reporte.equipo?.modelo ?? '—'}
                </FichaFila>
                <FichaFila label="Categoría">
                    <span className="flex items-center gap-1.5">
                        <Tag className="h-3 w-3 text-[#94A3B8]" /> {reporte.equipo_categoria ?? 'Sin categoría'}
                    </span>
                </FichaFila>
                <FichaFila label="Cliente">
                    <span className="flex items-center gap-1.5">
                        <Building2 className="h-3 w-3 text-[#94A3B8]" /> {reporte.cliente_nombre ?? 'Sin cliente'}
                    </span>
                </FichaFila>
            </div>
        </InfoCard>
    )
}

function SeccionTrabajo({ reporte }: { reporte: any }) {
    if (!reporte.diagnostico && !reporte.trabajo_realizado && !reporte.observaciones) return null

    const estadoPostStr = reporte.estado_equipo_post || 'operativo'
    const cfg = ESTADO_EQUIPO_POST[estadoPostStr] || ESTADO_EQUIPO_POST['operativo']
    const Icon = cfg.icon

    return (
        <InfoCard title="Descripción del trabajo" icon={ClipboardList}>
            <div className="space-y-4">
                {reporte.diagnostico && (
                    <div>
                        <p className="text-xs text-[#94A3B8] uppercase tracking-wide font-medium mb-1">Diagnóstico</p>
                        <p className="text-sm text-[#334155]">{reporte.diagnostico}</p>
                    </div>
                )}
                {reporte.trabajo_realizado && (
                    <div>
                        <p className="text-xs text-[#94A3B8] uppercase tracking-wide font-medium mb-1">Trabajo realizado</p>
                        <p className="text-sm text-[#334155] whitespace-pre-wrap leading-relaxed">{reporte.trabajo_realizado}</p>
                    </div>
                )}
                {reporte.observaciones && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs text-amber-700 uppercase font-medium mb-1">Observaciones</p>
                        <p className="text-sm text-amber-800">{reporte.observaciones}</p>
                    </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-[#E2E8F0]">
                    <p className="text-xs text-[#94A3B8]">Estado del equipo post-mantenimiento:</p>
                    <Badge className={`text-xs font-medium px-2 py-0.5 flex items-center gap-1 ${cfg.className}`}>
                        <Icon className="h-3 w-3" /> {cfg.label}
                    </Badge>
                </div>
            </div>
        </InfoCard>
    )
}

function SeccionChecklist({ actividades }: { actividades: any[] }) {
    if (!actividades || actividades.length === 0) return null

    const completadas = actividades.filter((a) => a.completada).length
    const pct = Math.round((completadas / actividades.length) * 100)
    const color = pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'

    return (
        <InfoCard title="Checklist realizado" icon={CheckSquare}>
            <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="flex-1 h-2.5 rounded-full bg-[#E2E8F0]">
                    <div className={`h-2.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm font-semibold text-[#0F172A] whitespace-nowrap">
                    {completadas} / {actividades.length}
                </span>
                <span className={`text-sm font-bold ${pct === 100 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                    {pct}% Completado
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {actividades.map((a, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg border border-[#E2E8F0] bg-[#FCFDFD]">
                        <div className={`mt-0.5 shrink-0 ${a.completada ? 'text-green-500' : 'text-[#CBD5E1]'}`}>
                            {a.completada ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        </div>
                        <div>
                            <p className={`text-sm font-medium leading-tight ${a.completada ? 'text-[#334155]' : 'text-[#94A3B8] strike-through'}`}>
                                {a.catalogo_actividades?.nombre}
                            </p>
                            {a.observacion && (
                                <p className="text-xs text-amber-600 mt-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 italic">
                                    Nota: {a.observacion}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </InfoCard>
    )
}

function SeccionInsumos({ usados, requeridos }: { usados: any[]; requeridos: any[] }) {
    if ((!usados || usados.length === 0) && (!requeridos || requeridos.length === 0)) return null

    return (
        <InfoCard title="Insumos y refacciones" icon={Package}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Utilizados
                    </h3>
                    {!usados || usados.length === 0 ? (
                        <p className="text-sm text-[#94A3B8]">Ninguno registrado</p>
                    ) : (
                        <ul className="space-y-2">
                            {usados.map((u, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-[#334155]">
                                    <span className="font-mono text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{u.cantidad}x</span>
                                    <span>
                                        {u.insumo?.nombre} <span className="text-[#94A3B8] text-xs">({u.insumo?.codigo_interno})</span>
                                        {u.observacion && <span className="block text-xs text-amber-600 italic mt-0.5">{u.observacion}</span>}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div>
                    <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Requeridos
                    </h3>
                    {!requeridos || requeridos.length === 0 ? (
                        <p className="text-sm text-[#94A3B8]">Ninguno requerido</p>
                    ) : (
                        <ul className="space-y-2">
                            {requeridos.map((req, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-[#334155]">
                                    <span className="font-mono text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{req.cantidad}x</span>
                                    <span className="flex-1">
                                        {req.insumo?.nombre} <span className="text-[#94A3B8] text-xs">({req.insumo?.codigo_interno})</span>
                                        {req.urgente && <Badge className="ml-2 bg-red-100 text-red-700 border-red-200 text-[10px] py-0">Urgente</Badge>}
                                        {req.observacion && <span className="block text-xs text-amber-600 italic mt-0.5">Motivo: {req.observacion}</span>}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </InfoCard>
    )
}

function FirmaCard({ titulo, nombre, fecha, hash, cerrado, tipo }: { titulo: string, nombre?: string, fecha?: string, hash?: string, cerrado: boolean, tipo: 'tecnico' | 'cliente' }) {
    const firmado = !!hash

    return (
        <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-center flex flex-col items-center justify-center min-h-[140px] relative">
            {!firmado && <div className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-amber-400" />}

            <div className={`flex h-10 w-10 items-center justify-center rounded-full mb-3
        ${firmado ? 'bg-green-100 text-green-600' : 'bg-[#E2E8F0] text-[#94A3B8]'}`}>
                {firmado ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
            </div>

            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1">{titulo}</p>

            {firmado ? (
                <div className="space-y-1">
                    {nombre && <p className="text-sm font-medium text-[#334155]">{nombre}</p>}
                    {fecha && <p className="text-xs text-[#94A3B8]">{formatFechaHora(fecha)}</p>}
                    <div className="mt-2 flex items-center gap-2 rounded bg-[#0F172A] px-2.5 py-1.5 mx-auto w-fit">
                        <ShieldCheck className="h-3 w-3 text-green-400 shrink-0" />
                        <span className="text-[10px] font-mono text-green-400 tracking-widest leading-none mt-0.5">
                            {abreviarHash(hash!)}
                        </span>
                    </div>
                </div>
            ) : (
                <p className="text-xs text-[#94A3B8] px-4">
                    {tipo === 'tecnico' ? 'El técnico aún no ha firmado.' : 'El cliente aún no ha firmado.'}
                </p>
            )}
        </div>
    )
}

function SeccionFirmas({ reporte }: { reporte: any }) {
    const cerrado = reporte.estado_reporte === 'cerrado'
    return (
        <InfoCard title="Firmas digitales" icon={ShieldCheck}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FirmaCard
                    titulo="Firma del técnico"
                    nombre={reporte.tecnico_principal?.nombre + ' ' + reporte.tecnico_principal?.apellido}
                    fecha={reporte.fecha_firma_tecnico}
                    hash={reporte.hash_firma_tecnico}
                    cerrado={cerrado}
                    tipo="tecnico"
                />
                <FirmaCard
                    titulo="Firma del cliente"
                    nombre={reporte.cliente_firma_nombre}
                    fecha={reporte.fecha_firma_cliente}
                    hash={reporte.hash_firma_cliente}
                    cerrado={cerrado}
                    tipo="cliente"
                />
            </div>
        </InfoCard>
    )
}

export default function ReporteDetalleAdminClient({ reporteRaw }: { reporteRaw: any }) {
    const router = useRouter()
    const reporte = reporteRaw

    const [modalAnularOpen, setModalAnularOpen] = useState(false)
    const [motivo, setMotivo] = useState('')
    const [cargando, setCargando] = useState(false)
    const [errorAnular, setErrorAnular] = useState<string | null>(null)

    async function handleConfirmarAnulacion() {
        setCargando(true)
        setErrorAnular(null)
        const res = await anularReporte({ reporte_id: reporte.id, motivo })
        setCargando(false)
        if (res.error) {
            setErrorAnular(res.error)
            return
        }
        setModalAnularOpen(false)
        setMotivo('')
        router.refresh()
    }

    function handleOpenModal() {
        setMotivo('')
        setErrorAnular(null)
        setModalAnularOpen(true)
    }

    return (
        <div className="space-y-6 max-w-5xl">
            {/* Botón volver */}
            <Button variant="ghost" size="sm" onClick={() => router.push('/admin/reportes')}
                className="gap-1.5 text-[#94A3B8] hover:text-[#334155] -ml-2 px-2">
                <ArrowLeft className="h-4 w-4" /> Reportes
            </Button>

            <SeccionHeader reporte={reporte} onAnularClick={handleOpenModal} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SeccionEquipo reporte={reporte} router={router} />
                <SeccionTrabajo reporte={reporte} />
            </div>

            <SeccionChecklist actividades={reporte.actividades} />

            <SeccionInsumos usados={reporte.insumos_usados} requeridos={reporte.insumos_requeridos} />

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2">
                    <InfoCard title="Técnico a cargo" icon={HardHat}>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1E40AF]/10 text-[#1E40AF] font-bold text-sm">
                                {reporte.tecnico_principal?.nombre?.[0]}{reporte.tecnico_principal?.apellido?.[0]}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-[#0F172A]">
                                    {reporte.tecnico_principal?.nombre} {reporte.tecnico_principal?.apellido}
                                </p>
                                <p className="text-xs text-[#94A3B8]">Técnico Principal</p>
                            </div>
                        </div>
                    </InfoCard>
                </div>
                <div className="lg:col-span-3">
                    <SeccionFirmas reporte={reporte} />
                </div>
            </div>

            {/* Modal de confirmación de anulación */}
            <Dialog open={modalAnularOpen} onOpenChange={(open) => { if (!cargando) setModalAnularOpen(open) }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                            Anular reporte
                        </DialogTitle>
                        <DialogDescription className="text-[#334155]">
                            Esta acción no se puede deshacer. El reporte{' '}
                            <span className="font-mono font-semibold">
                                {reporte.numero_reporte_fisico ?? `#${abreviarId(reporte.id)}`}
                            </span>{' '}
                            pasará a estado <span className="font-semibold">Anulado</span>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2 py-2">
                        <label className="text-sm font-medium text-[#0F172A]">
                            Motivo de anulación <span className="text-red-500">*</span>
                        </label>
                        <Textarea
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            placeholder="Describe el motivo por el que se anula este reporte..."
                            className="resize-none h-24 text-sm"
                            disabled={cargando}
                        />
                        <p className={`text-xs ${motivo.length < 10 ? 'text-[#94A3B8]' : 'text-green-600'}`}>
                            {motivo.length < 10
                                ? `Mínimo 10 caracteres (${motivo.length}/10)`
                                : `${motivo.length} caracteres`}
                        </p>
                        {errorAnular && (
                            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                                {errorAnular}
                            </p>
                        )}
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setModalAnularOpen(false)} disabled={cargando}>
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmarAnulacion}
                            disabled={motivo.length < 10 || cargando}
                        >
                            {cargando ? 'Anulando...' : 'Confirmar anulación'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
