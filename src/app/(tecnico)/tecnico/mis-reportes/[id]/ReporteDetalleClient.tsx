'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowLeft, ClipboardList, Package, HardHat, ShieldCheck,
    Clock, Building2, CheckSquare, CheckCircle2, AlertCircle, MapPin, Eye, Copy
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ESTADO_REPORTE_CFG } from '@/components/admin/reportes/ReportesTable'
import type { EstadoReporte } from '@/types'
import FirmaClienteModal from '@/components/tecnico/FirmaClienteModal'
import ModalDuplicarReporte from '@/components/tecnico/ModalDuplicarReporte'

function abreviarId(uuid: string) {
    if (!uuid) return ''
    const parts = uuid.split('-')
    return parts[parts.length - 1].substring(0, 6).toUpperCase()
}

function formatFecha(iso: string) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('es-EC', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    })
}

// Card base UI
function InfoCard({ children, title, icon: Icon }: { children: React.ReactNode; title: string; icon?: any }) {
    return (
        <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
                {Icon && <Icon className="h-4 w-4 text-[#94A3B8]" />}
                <h2 className="text-base font-semibold text-[#0F172A]">{title}</h2>
            </div>
            {children}
        </div>
    )
}

function FichaFila({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 py-2 border-b border-[#E2E8F0] last:border-0">
            <p className="text-xs font-semibold text-[#64748B] w-32 shrink-0">{label}</p>
            <div className="text-sm text-[#0F172A] flex-1 break-words">{children}</div>
        </div>
    )
}

export default function ReporteDetalleClient({ reporte }: { reporte: any }) {
    console.log('[ReporteDetalleClient] estado_equipo_post recibido:', reporte.estado_equipo_post)
    const router = useRouter()
    const [modalFirmaOpen, setModalFirmaOpen] = useState(false)
    const [modalDuplicarOpen, setModalDuplicarOpen] = useState(false)
    const [reloadKey, setReloadKey] = useState(0) // para forzar refresh al firmar

    const getEstadoDisplay = (estado: string) => {
        return ESTADO_REPORTE_CFG[estado as EstadoReporte] || { label: estado, className: 'bg-gray-100 text-gray-700' }
    }

    const estadoCfg = getEstadoDisplay(reporte.estado_reporte)

    // Status Checks
    const isCerrado = reporte.estado_reporte === 'cerrado'
    const firmaTecnicaCompletada =
        reporte.estado_reporte === 'pendiente_firma_cliente' ||
        reporte.estado_reporte === 'cerrado' ||
        reporte.estado_reporte === 'anulado'

    const getPasoRetorno = () => {
        if (!reporte) return 1
        if (reporte.insumos_usados?.length > 0 || reporte.accesorios?.length > 0) return 4
        if (reporte.diagnostico || reporte.trabajo_realizado || reporte.estado_equipo || reporte.actividades?.length > 0) return 3
        if (reporte.tipo_mantenimiento_id || reporte.fecha_inicio) return 2
        return 1
    }

    const handleFirmarClienteDone = () => {
        router.refresh()
    }

    return (
        <div className="space-y-4 max-w-4xl mx-auto pb-8">
            {/* Header / Botón Volver */}
            <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => router.push('/tecnico/mis-reportes')}
                    className="gap-1.5 text-[#94A3B8] hover:text-[#334155] -ml-2 shrink-0">
                    <ArrowLeft className="h-4 w-4" /> Volver
                </Button>
                
                <div className="flex gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setModalDuplicarOpen(true)}
                        className="gap-1.5 text-[#1E40AF] border-[#1E40AF]/30 hover:bg-blue-50/50 h-9"
                    >
                        <Copy className="h-4 w-4" />
                        Duplicar Informe
                    </Button>
                </div>
            </div>

            {/* Cabecera Info Reporte */}
            <InfoCard title="Información General" icon={ClipboardList}>
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-mono font-bold text-[#1E40AF]">
                                {reporte.numero_reporte_fisico ?? `#${abreviarId(reporte.id)}`}
                            </span>
                            <Badge className={`text-xs px-2 py-0.5 rounded-full ${estadoCfg.className}`}>
                                {estadoCfg.label}
                            </Badge>
                        </div>
                        <p className="text-xs text-[#64748B] mt-1">{formatFecha(reporte.fecha_inicio)}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                    <FichaFila label="Equipo">
                        <span className="font-mono font-bold text-[#1E40AF] mr-1">{reporte.equipo_codigo_mh}</span>
                        {reporte.equipo_nombre}
                    </FichaFila>
                    <FichaFila label="Marca / Modelo">
                        {reporte.equipo_marca_snapshot || '(Genérico)'} · {reporte.equipo_modelo_snapshot || '—'}
                    </FichaFila>
                    <FichaFila label="Serie">
                        <span className="font-mono">{reporte.equipo_serie_snapshot || '—'}</span>
                    </FichaFila>
                    <FichaFila label="Ubicación">
                        <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-[#94A3B8]" /> {reporte.ubicacion_nombre || 'No asignada'}</span>
                    </FichaFila>
                    <FichaFila label="Tipo Mantenimiento">
                        {reporte.tipo_mantenimiento_nombre || '(Por definir)'}
                    </FichaFila>
                </div>
            </InfoCard>

            {/* Trabajo Realizado */}
            {(reporte.diagnostico || reporte.trabajo_realizado || reporte.observaciones) && (
                <InfoCard title="Desarrollo del Trabajo" icon={HardHat}>
                    <div className="space-y-3">
                        {reporte.diagnostico && (
                            <div>
                                <p className="text-xs text-[#94A3B8] uppercase tracking-wide font-medium mb-1">Diagnóstico</p>
                                <p className="text-sm text-[#334155] whitespace-pre-wrap">{reporte.diagnostico}</p>
                            </div>
                        )}
                        {reporte.trabajo_realizado && (
                            <div>
                                <p className="text-xs text-[#94A3B8] uppercase tracking-wide font-medium mb-1">Trabajo Realizado</p>
                                <p className="text-sm text-[#334155] whitespace-pre-wrap">{reporte.trabajo_realizado}</p>
                            </div>
                        )}
                        {reporte.observaciones && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                                <p className="text-xs text-amber-700 uppercase font-medium mb-1">Observaciones / Notas Técnicas</p>
                                <p className="text-sm text-amber-800">{reporte.observaciones}</p>
                            </div>
                        )}
                        <div className="pt-2 border-t flex items-center gap-2">
                            <p className="text-xs font-medium text-[#64748B]">Estado post-intervención:</p>
                            {reporte.estado_equipo_post ? (
                                <Badge variant="outline" className={`${reporte.estado_equipo_post === 'operativo' ? 'bg-green-50 text-green-700 border-green-200' :
                                        reporte.estado_equipo_post === 'restringido' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                            reporte.estado_equipo_post === 'no_operativo' ? 'bg-red-50 text-red-700 border-red-200' :
                                                reporte.estado_equipo_post === 'almacenado' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                                                    reporte.estado_equipo_post === 'dado_de_baja' ? 'bg-red-100 text-red-900 border-red-300' :
                                                        'bg-slate-50 text-slate-500 border-slate-200'
                                    }`}>
                                    {reporte.estado_equipo_post.replace('_', ' ').toUpperCase()}
                                </Badge>
                            ) : (
                                <span className="text-xs text-[#94A3B8]">—</span>
                            )}
                        </div>
                    </div>
                </InfoCard>
            )}

            {/* Checklist */}
            {reporte.actividades && reporte.actividades.length > 0 && (
                <InfoCard title={`Checklist (${reporte.actividades.filter((a: any) => a.completada).length}/${reporte.actividades.length})`} icon={CheckSquare}>
                    <div className="space-y-1.5 mt-2">
                        {reporte.actividades.map((a: any, i: number) => (
                            <div key={i} className={`flex items-start gap-2 p-2 rounded-lg border ${a.completada ? 'border-green-100 bg-green-50/30' : 'border-[#E2E8F0] bg-slate-50'}`}>
                                {a.completada ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 text-[#CBD5E1] shrink-0 mt-0.5" />}
                                <div className="text-sm flex-1">
                                    <p className={a.completada ? 'text-[#0F172A]' : 'text-[#64748B]'}>{a.catalogo_actividades?.nombre || 'Verificación'}</p>
                                    {a.observacion && <p className="text-xs text-[#64748B] italic">Nota: {a.observacion}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                </InfoCard>
            )}

            {/* Insumos */}
            {(reporte.insumos_usados?.length > 0 || reporte.insumos_requeridos?.length > 0) && (
                <InfoCard title="Insumos Registrados" icon={Package}>
                    <div className="space-y-4">
                        {reporte.insumos_usados?.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold uppercase text-[#64748B] mb-2">Usados (Stock)</h3>
                                <ul className="space-y-1">
                                    {reporte.insumos_usados.map((i: any, idx: number) => (
                                        <li key={idx} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-2 rounded text-sm">
                                            <span>{i.insumo?.nombre}</span>
                                            <span className="font-semibold text-[#0F172A]">{i.cantidad}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {reporte.insumos_requeridos?.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold uppercase text-[#64748B] mb-2">Requeridos (Por surtir)</h3>
                                <ul className="space-y-1">
                                    {reporte.insumos_requeridos.map((i: any, idx: number) => (
                                        <li key={idx} className={`flex justify-between items-center border p-2 rounded text-sm ${i.urgente ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                                            <span className="flex items-center gap-2">
                                                {i.insumo?.nombre}
                                                {i.urgente && <Badge className="bg-red-100 text-red-700 text-[10px] px-1 py-0">Urgente</Badge>}
                                            </span>
                                            <span className="font-semibold text-[#0F172A]">{i.cantidad}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </InfoCard>
            )}

            {/* Firmas Action Panel */}
            <InfoCard title="Autenticación y Cierre" icon={ShieldCheck}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Firma Tecnico */}
                    <div className="border p-4 rounded-xl flex flex-col items-center justify-center text-center gap-2 relative bg-slate-50">
                        {firmaTecnicaCompletada ? (
                            <>
                                <CheckCircle2 className="h-8 w-8 text-green-500" />
                                <div>
                                    <p className="text-sm font-semibold text-[#0F172A] mb-1">Firma Técnica Registrada</p>
                                    <p className="text-[10px] text-green-700 font-mono mt-1 break-all bg-green-100 px-2 py-0.5 rounded truncate max-w-[120px]">
                                        {reporte.hash_firma_tecnico}
                                    </p>
                                    <Button
                                        onClick={() => router.push(`/tecnico/nuevo-reporte/${reporte.equipo_id}?reporteId=${reporte.id}&paso=1&modo=lectura`)}
                                        variant="outline"
                                        className="mt-3 text-xs h-7 gap-1.5 text-slate-700"
                                    >
                                        <Eye className="h-3.5 w-3.5" />
                                        Ver reporte
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <>
                                <AlertCircle className="h-8 w-8 text-amber-500" />
                                <div>
                                    <p className="text-sm font-semibold text-[#0F172A] mb-2">
                                        {reporte.estado_reporte === 'en_progreso' ? 'Edición en progreso' : 'Requiere Firma Técnica'}
                                    </p>
                                    <Button onClick={() => router.push(`/tecnico/nuevo-reporte/${reporte.equipo_id}?reporteId=${reporte.id}&paso=${getPasoRetorno()}`)} className="bg-[#1E40AF] hover:bg-[#1E3A8A]">
                                        {reporte.estado_reporte === 'en_progreso' ? 'Continuar Reporte' : 'Firmar Ahora (Wizard)'}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Firma Cliente */}
                    <div className="border p-4 rounded-xl flex flex-col items-center justify-center text-center gap-2 relative bg-slate-50">
                        {reporte.hash_firma_cliente ? (
                            <>
                                <CheckCircle2 className="h-8 w-8 text-green-500" />
                                <div>
                                    <p className="text-sm font-semibold text-[#0F172A]">Cliente: {reporte.cliente_firma_nombre}</p>
                                    <p className="text-xs text-green-700 font-mono mt-1 break-all bg-green-100 px-2 py-1 rounded">
                                        HASH: {reporte.hash_firma_cliente.slice(0, 16)}...
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                {reporte.hash_firma_tecnico ? (
                                    <>
                                        <Clock className="h-8 w-8 text-orange-500" />
                                        <div>
                                            <p className="text-sm font-semibold text-[#0F172A] mb-2">Pendiente Cliente</p>
                                            <Button onClick={() => setModalFirmaOpen(true)} className="bg-orange-600 hover:bg-orange-700">
                                                Cerrar y Firmar (Cliente)
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <Clock className="h-8 w-8 text-slate-300" />
                                        <p className="text-sm text-slate-500">Bloqueado hasta firma técnica.</p>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </InfoCard>

            {/* Modal Duplicar */}
            <ModalDuplicarReporte 
                reporteIdOriginal={reporte.id}
                open={modalDuplicarOpen}
                onOpenChange={setModalDuplicarOpen}
            />
        </div>
    )
}
