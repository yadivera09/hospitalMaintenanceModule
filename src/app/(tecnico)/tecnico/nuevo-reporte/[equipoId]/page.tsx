'use client'

// ── Tipo del draft en localStorage
interface DraftData { datos: WizardDatos; paso: number; savedAt: string }

/**
 * src/app/(tecnico)/tecnico/nuevo-reporte/[equipoId]/page.tsx
 * Wizard de 4 pasos para crear un nuevo reporte de mantenimiento.
 * Paso 1 — Info general
 * Paso 2 — Descripción + checklist
 * Paso 3 — Insumos
 * Paso 4 — Revisión + firma digital
 *
 * react-signature-canvas se carga dinámicamente (ssr: false).
 * BLOQUE 1 — usa datos mock.
 */

import { useState, useRef, useMemo, useEffect, useTransition } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
    ArrowLeft, Check, ChevronRight, X,
    CheckCircle2, Package, Pencil, Plus, Trash2,
    AlertTriangle, FileCheck, HardHat,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import { getActividadesByCategoria } from '@/mocks/catalogos'
import { getTiposMantenimiento, getUbicaciones, getInsumos, TipoMantenimiento, UbicacionConCliente, Insumo } from '@/app/actions/catalogos'
import type { ActividadChecklist } from '@/types'
import type SignatureCanvasType from 'react-signature-canvas'
import { useForm, useFieldArray } from 'react-hook-form'
import InsumoSelector from '@/components/tecnico/InsumoSelector'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

// ── Wrapper client-only para SignatureCanvas
// Se usa un componente separado para evitar conflictos de ref con next/dynamic
import SignatureCanvasLib from 'react-signature-canvas'

interface SigPadProps {
    padRef: React.MutableRefObject<SignatureCanvasType | null>
    onEnd: () => void
}

function SignaturePad({ padRef, onEnd }: SigPadProps) {
    return (
        <SignatureCanvasLib
            ref={(el) => { padRef.current = el }}
            penColor="#1E40AF"
            canvasProps={{ className: 'w-full', height: 144, style: { width: '100%' } }}
            onEnd={onEnd}
        />
    )
}

// ── Técnico actual (BLOQUE 1 — mock)
const TEC_ACTUAL_ID = 'tec-0001-0001-0001-0001-000000000001'

const ESTADOS_EQUIPO_POST: { value: 'operativo' | 'restringido' | 'no_operativo' | 'almacenado' | 'dado_de_baja'; label: string; cls: string }[] = [
    { value: 'operativo', label: 'Operativo', cls: 'text-green-700 bg-green-50 border-green-200' },
    { value: 'restringido', label: 'Restringido', cls: 'text-amber-700 bg-amber-50 border-amber-200' },
    { value: 'no_operativo', label: 'No operativo', cls: 'text-red-700 bg-red-50 border-red-200' },
    { value: 'almacenado', label: 'Almacenado', cls: 'text-[#64748B] bg-[#F1F5F9] border-[#E2E8F0]' },
    { value: 'dado_de_baja', label: 'Dado de baja', cls: 'text-red-900 bg-red-100 border-red-300' },
]

const MOTIVOS_VISITA = [
    { value: 'garantia', label: 'Garantía' },
    { value: 'contrato', label: 'Contrato' },
    { value: 'demo', label: 'Demo' },
    { value: 'emergencia', label: 'Emergencia' },
    { value: 'llamada', label: 'Llamada' },
    { value: 'capacitacion', label: 'Capacitación' },
]

// ── Tipos internos del wizard
interface ChecklistItem { 
    actividad_id: string; 
    nombre: string;
    es_obligatoria: boolean;
    completada: boolean; 
    observacion: string | null 
}
interface InsumoItem { uid: string; insumo_id: string; nombre: string; codigo: string | null; unidad: string; cantidad: number; es_nuevo: boolean }
interface InsumoReqItem extends InsumoItem { motivo: string | null }
interface AccesorioItem { uid: string; descripcion: string; cantidad: number; estado_equipo_contexto: 'operativo' | 'restringido' | 'no_operativo' }

interface WizardDatos {
    // ── Información general
    tipo_mantenimiento_id: string
    fecha_ejecucion: string
    hora_entrada: string         // HH:MM
    hora_salida: string | null          // HH:MM
    ciudad: string
    solicitado_por: string
    motivo_visita: string
    numero_reporte_fisico: string | null
    ubicacion_id: string
    ubicacion_detalle: string | null
    tecnicos_apoyo: string[]
    // ── Snapshots (auto-fill silencioso)
    equipo_marca_snapshot: string
    equipo_modelo_snapshot: string
    equipo_serie_snapshot: string
    // ── Descripción
    diagnostico: string
    trabajo_realizado: string
    estado_equipo_post: 'operativo' | 'restringido' | 'no_operativo' | 'almacenado' | 'dado_de_baja'
    checklist: ChecklistItem[]
    // ── Insumos
    insumos_usados: InsumoItem[]
    insumos_requeridos: InsumoReqItem[]
    // ── Accesorios / Repuestos (fase6)
    accesorios: AccesorioItem[]
    // ── Firma técnico
    firma_tecnico: string | null
}

// ── Esquemas de validación por página
const paso1Schema = z.object({
    tipo_mantenimiento_id: z.string().uuid('Debe seleccionar el tipo de mantenimiento'),
    fecha_ejecucion: z.string().min(1, 'La fecha es requerida'),
    hora_entrada: z.string().min(1, 'La hora de entrada es requerida'),
    hora_salida: z.string().nullable(),
    ciudad: z.string().min(1, 'La ciudad es requerida'),
    solicitado_por: z.string().min(1, 'Solicitado por es requerido'),
    motivo_visita: z.string().min(1, 'El motivo es requerido'),
    numero_reporte_fisico: z.string().nullable(),
    ubicacion_id: z.string().uuid('Debe seleccionar la ubicación'),
    ubicacion_detalle: z.string().nullable(),
    tecnicos_apoyo: z.array(z.string()),
})

const paso2Schema = z.object({
    diagnostico: z.string().min(1, 'El diagnóstico es requerido'),
    trabajo_realizado: z.string().min(1, 'El trabajo realizado es requerido'),
    estado_equipo_post: z.enum(['operativo', 'restringido', 'no_operativo', 'almacenado', 'dado_de_baja']),
    checklist: z.array(z.object({
        actividad_id: z.string(),
        nombre: z.string(),
        es_obligatoria: z.boolean(),
        completada: z.boolean(),
        observacion: z.string().nullable()
    })).refine(items => {
        // Validar que todas las obligatorias estén completadas
        return items.every(item => !item.es_obligatoria || item.completada);
    }, {
        message: 'Debes completar todas las actividades obligatorias',
        path: ['checklist'] // Para que el error se asocie al campo checklist
    }),
})

const paso3Schema = z.object({
    insumos_usados: z.array(z.object({
        uid: z.string(),
        insumo_id: z.string(),
        nombre: z.string(),
        codigo: z.string().nullable(),
        unidad: z.string(),
        cantidad: z.number().gt(0, 'Debe ser > 0')
    })),
    insumos_requeridos: z.array(z.object({
        uid: z.string(),
        insumo_id: z.string(),
        nombre: z.string(),
        codigo: z.string().nullable(),
        unidad: z.string(),
        cantidad: z.number().gt(0, 'Debe ser > 0'),
        motivo: z.string().nullable()
    })),
    accesorios: z.array(z.object({
        uid: z.string(),
        descripcion: z.string().min(1, 'Descripción requerida'),
        cantidad: z.number().gt(0, 'Debe ser > 0'),
        estado_equipo_contexto: z.enum(['operativo', 'restringido', 'no_operativo'])
    })),
})

const paso4Schema = z.object({
    firma_tecnico: z.string().nullable().refine((val) => val !== null && val.length > 0, {
        message: 'La firma del técnico es requerida'
    }),
})

const wizardSchema = paso1Schema.merge(paso2Schema).merge(paso3Schema).merge(paso4Schema).extend({
    equipo_marca_snapshot: z.string(),
    equipo_modelo_snapshot: z.string(),
    equipo_serie_snapshot: z.string(),
})

function hoy() { return new Date().toISOString().split('T')[0] }

// ── Indicador de pasos
function PasoIndicador({ paso, total }: { paso: number; total: number }) {
    const labels = ['Info general', 'Descripción', 'Insumos', 'Firma']
    return (
        <div className="flex items-center gap-1">
            {Array.from({ length: total }).map((_, i) => {
                const n = i + 1
                const done = n < paso, current = n === paso
                return (
                    <div key={n} className="flex items-center gap-1 flex-1">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold border-2 transition-all
              ${done ? 'bg-[#1E40AF] border-[#1E40AF] text-white' : current ? 'bg-white border-[#1E40AF] text-[#1E40AF]' : 'bg-white border-[#E2E8F0] text-[#94A3B8]'}`}>
                            {done ? <Check className="h-3.5 w-3.5" /> : n}
                        </div>
                        {i < total - 1 && (
                            <div className={`flex-1 h-0.5 rounded-full transition-colors
                ${n < paso ? 'bg-[#1E40AF]' : 'bg-[#E2E8F0]'}`} />
                        )}
                    </div>
                )
            })}
        </div>
    )
}

// ── PASO 1 — Información general
function Paso1({ datos, onChange, tecnicos, tecnicoActualId, tiposMantenimiento, ubicaciones, readOnly, errors }: { datos: WizardDatos; onChange: (d: Partial<WizardDatos>) => void; tecnicos: TecnicoData[]; tecnicoActualId?: string; tiposMantenimiento: TipoMantenimiento[]; ubicaciones: UbicacionConCliente[]; readOnly?: boolean; errors?: any }) {
    const otrosTecnicos = tecnicos.filter((t) => t.id !== tecnicoActualId)

    function toggleApoyo(id: string) {
        const arr = datos.tecnicos_apoyo.includes(id)
            ? datos.tecnicos_apoyo.filter((x) => x !== id)
            : [...datos.tecnicos_apoyo, id]
        onChange({ tecnicos_apoyo: arr })
    }

    return (
        <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[#0F172A]">Información general</h2>

            {/* Tipo mantenimiento */}
            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#334155]">Tipo de mantenimiento *</Label>
                <Select value={datos.tipo_mantenimiento_id} onValueChange={(v) => onChange({ tipo_mantenimiento_id: v })} disabled={readOnly}>
                    <SelectTrigger className={`h-11 bg-white border-[#E2E8F0] disabled:opacity-100 disabled:bg-slate-50 ${errors?.tipo_mantenimiento_id ? 'border-red-500' : ''}`}><SelectValue placeholder="Selecciona el tipo…" /></SelectTrigger>
                    <SelectContent>
                        {tiposMantenimiento.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
                    </SelectContent>
                </Select>
                {errors?.tipo_mantenimiento_id && <p className="text-[10px] text-red-500 font-medium">{errors.tipo_mantenimiento_id.message}</p>}
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#334155]">Servicio por (motivo) *</Label>
                <Select value={datos.motivo_visita ?? ''} onValueChange={(v) => onChange({ motivo_visita: v })} disabled={readOnly}>
                    <SelectTrigger className={`h-11 bg-white border-[#E2E8F0] disabled:opacity-100 disabled:bg-slate-50 ${errors?.motivo_visita ? 'border-red-500' : ''}`}><SelectValue placeholder="Garantía / Contrato / Demo…" /></SelectTrigger>
                    <SelectContent>
                        {MOTIVOS_VISITA.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                </Select>
                {errors?.motivo_visita && <p className="text-[10px] text-red-500 font-medium">{errors.motivo_visita.message}</p>}
            </div>

            {/* Fecha + horas */}
            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#334155]">Fecha de ejecución *</Label>
                <Input type="date" value={datos.fecha_ejecucion} max={hoy()} disabled={readOnly}
                    onChange={(e) => onChange({ fecha_ejecucion: e.target.value })}
                    className={`h-11 bg-white border-[#E2E8F0] disabled:opacity-100 disabled:bg-slate-50 ${errors?.fecha_ejecucion ? 'border-red-500' : ''}`} />
                {errors?.fecha_ejecucion && <p className="text-[10px] text-red-500 font-medium">{errors.fecha_ejecucion.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-[#334155]">Hora entrada *</Label>
                    <Input type="time" value={datos.hora_entrada ?? ''} disabled={readOnly}
                        onChange={(e) => onChange({ hora_entrada: e.target.value })}
                        className={`h-11 bg-white border-[#E2E8F0] disabled:opacity-100 disabled:bg-slate-50 ${errors?.hora_entrada ? 'border-red-500' : ''}`} />
                    {errors?.hora_entrada && <p className="text-[10px] text-red-500 font-medium">{errors.hora_entrada.message}</p>}
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-[#334155]">Hora salida</Label>
                    <Input type="time" value={datos.hora_salida ?? ''} disabled={readOnly}
                        onChange={(e) => onChange({ hora_salida: e.target.value })}
                        className="h-11 bg-white border-[#E2E8F0] disabled:opacity-100 disabled:bg-slate-50" />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#334155]">Ciudad *</Label>
                <Input placeholder="Guayaquil" value={datos.ciudad ?? ''} disabled={readOnly}
                    onChange={(e) => onChange({ ciudad: e.target.value })}
                    className={`bg-white border-[#E2E8F0] disabled:opacity-100 disabled:bg-slate-50 ${errors?.ciudad ? 'border-red-500' : ''}`} />
                {errors?.ciudad && <p className="text-[10px] text-red-500 font-medium">{errors.ciudad.message}</p>}
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#334155]">Solicitado por *</Label>
                <Input placeholder="Nombre del contacto en el cliente…" value={datos.solicitado_por ?? ''} disabled={readOnly}
                    onChange={(e) => onChange({ solicitado_por: e.target.value })}
                    className={`bg-white border-[#E2E8F0] disabled:opacity-100 disabled:bg-slate-50 ${errors?.solicitado_por ? 'border-red-500' : ''}`} />
                {errors?.solicitado_por && <p className="text-[10px] text-red-500 font-medium">{errors.solicitado_por.message}</p>}
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#334155]">Ubicación *</Label>
                <Select value={datos.ubicacion_id ?? ''} onValueChange={(v) => onChange({ ubicacion_id: v })} disabled={readOnly}>
                    <SelectTrigger className={`h-11 bg-white border-[#E2E8F0] disabled:opacity-100 disabled:bg-slate-50 ${errors?.ubicacion_id ? 'border-red-500' : ''}`}><SelectValue placeholder="Sala o piso…" /></SelectTrigger>
                    <SelectContent>
                        {ubicaciones.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                                {u.nombre}{u.cliente ? ` — ${u.cliente.razon_social}` : ''}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {errors?.ubicacion_id && <p className="text-[10px] text-red-500 font-medium">{errors.ubicacion_id.message}</p>}
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#334155]">Detalle de ubicación (opcional)</Label>
                <Input placeholder="Cama 12, sala 3…" value={datos.ubicacion_detalle ?? ''} disabled={readOnly}
                    onChange={(e) => onChange({ ubicacion_detalle: e.target.value })}
                    className="bg-white border-[#E2E8F0] disabled:opacity-100 disabled:bg-slate-50" />
            </div>

            {/* Nro reporte físico */}
            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#334155]">N° reporte físico (opcional)</Label>
                <Input placeholder="Ej: 0007325" value={datos.numero_reporte_fisico ?? ''} disabled={readOnly}
                    onChange={(e) => onChange({ numero_reporte_fisico: e.target.value })}
                    className="bg-white border-[#E2E8F0] font-mono disabled:opacity-100 disabled:bg-slate-50" />
                <p className="text-[10px] text-[#94A3B8]">Para trazabilidad con reportes en papel anteriores</p>
            </div>

            {/* Técnicos apoyo */}
            <div className="space-y-2">
                <Label className="text-xs font-medium text-[#334155]">Técnicos de apoyo</Label>
                {otrosTecnicos.map((t) => (
                    <label key={t.id} className={`flex items-center gap-3 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 ${readOnly ? 'opacity-90' : 'cursor-pointer hover:bg-[#F8FAFC]'}`}>
                        <Switch checked={datos.tecnicos_apoyo.includes(t.id)} onCheckedChange={() => toggleApoyo(t.id)} disabled={readOnly} />
                        <div>
                            <p className="text-sm font-medium text-[#334155]">{t.nombre} {t.apellido}</p>
                        </div>
                    </label>
                ))}
            </div>
        </div>
    )
}


// ── PASO 2 — Descripción + checklist
function Paso2({ datos, onChange, readOnly, errors, checklistTemplate }: { 
    datos: WizardDatos; 
    onChange: (d: Partial<WizardDatos>) => void; 
    readOnly?: boolean; 
    errors?: any;
    checklistTemplate: any[]; 
}) {

    useEffect(() => {
        if (datos.checklist.length === 0 && checklistTemplate.length > 0) {
            onChange({
                checklist: checklistTemplate.map((a) => ({ 
                    actividad_id: a.id, 
                    nombre: a.descripcion,
                    es_obligatoria: a.obligatoria,
                    completada: false, 
                    observacion: '' 
                }))
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [checklistTemplate])

    function toggleCheck(actId: string) {
        onChange({
            checklist: datos.checklist.map((c) =>
                c.actividad_id === actId ? { ...c, completada: !c.completada } : c
            )
        })
    }
    function setObservacion(actId: string, obs: string) {
        onChange({
            checklist: datos.checklist.map((c) =>
                c.actividad_id === actId ? { ...c, observacion: obs } : c
            )
        })
    }

    const completadas = datos.checklist.filter((c) => c.completada).length
    const total = datos.checklist.length

    return (
        <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[#0F172A]">Descripción del trabajo</h2>

            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#334155]">Diagnóstico *</Label>
                <Textarea placeholder="Describe el diagnóstico o problema encontrado…"
                    value={datos.diagnostico ?? ''} rows={3} disabled={readOnly}
                    onChange={(e) => onChange({ diagnostico: e.target.value })}
                    className={`bg-white border-[#E2E8F0] resize-none text-sm disabled:opacity-100 disabled:bg-slate-50 ${errors?.diagnostico ? 'border-red-500' : ''}`} />
                {errors?.diagnostico && <p className="text-[10px] text-red-500 font-medium">{errors.diagnostico.message}</p>}
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#334155]">Trabajo realizado *</Label>
                <Textarea placeholder="Detalla las acciones realizadas durante el mantenimiento…"
                    value={datos.trabajo_realizado ?? ''} rows={4} disabled={readOnly}
                    onChange={(e) => onChange({ trabajo_realizado: e.target.value })}
                    className={`bg-white border-[#E2E8F0] resize-none text-sm disabled:opacity-100 disabled:bg-slate-50 ${errors?.trabajo_realizado ? 'border-red-500' : ''}`} />
                {errors?.trabajo_realizado && <p className="text-[10px] text-red-500 font-medium">{errors.trabajo_realizado.message}</p>}
            </div>


            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#334155]">Estado del equipo post-mantenimiento *</Label>
                <div className="grid grid-cols-2 gap-2">
                    {ESTADOS_EQUIPO_POST.map((e) => (
                        <button key={e.value} type="button" disabled={readOnly}
                            onClick={() => onChange({ estado_equipo_post: e.value })}
                            className={`rounded-lg border-2 px-3 py-2.5 text-xs font-semibold transition-all text-center
                ${datos.estado_equipo_post === e.value
                                    ? `${e.cls} border-current ring-2 ring-offset-1 ring-current`
                                    : errors?.estado_equipo_post ? 'border-red-300 text-red-400 bg-red-50' : 'border-[#E2E8F0] text-[#94A3B8] bg-white'}`}>
                            {e.label}
                        </button>
                    ))}
                </div>
                {errors?.estado_equipo_post && <p className="text-[10px] text-red-500 font-medium">{errors.estado_equipo_post.message}</p>}
            </div>

            {/* Checklist */}
            {total > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-[#334155]">Checklist</Label>
                        <span className="text-xs text-[#94A3B8]">{completadas}/{total} completadas</span>
                    </div>
                    {/* Barra de progreso */}
                    <div className="h-1.5 rounded-full bg-[#E2E8F0]">
                        <div className={`h-1.5 rounded-full transition-all ${completadas === total ? 'bg-green-500' : 'bg-[#1E40AF]'}`}
                            style={{ width: `${total > 0 ? (completadas / total * 100) : 0}%` }} />
                    </div>
                    <div className="space-y-1.5" id="checklist-wizard">
                        {datos.checklist.map((ci, idx) => {
                            return (
                                <div key={ci.actividad_id} className={`rounded-lg border px-3 py-2.5 transition-colors
                  ${ci.completada ? 'border-green-200 bg-green-50/40' : 'border-[#E2E8F0] bg-white'}`}>
                                    <label className={`flex items-start gap-3 ${readOnly ? '' : 'cursor-pointer'}`}>
                                        <button type="button" onClick={() => toggleCheck(ci.actividad_id)} disabled={readOnly}
                                            className={`mt-0.5 flex h-5 w-5 shrink-0 rounded items-center justify-center border-2 transition-colors
                        ${ci.completada ? 'bg-green-500 border-green-500' : 'border-[#CBD5E1] bg-white'}`}>
                                            {ci.completada && <Check className="h-3 w-3 text-white" />}
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start gap-2">
                                                <p className={`text-xs flex-1 ${ci.completada ? 'text-[#0F172A]' : 'text-[#64748B]'}`}>
                                                    <span className="text-[10px] font-mono text-[#94A3B8] mr-1">{idx + 1}.</span>
                                                    {ci.nombre}
                                                </p>
                                                <Badge variant="outline" className={`text-[9px] px-1.5 py-0 rounded transition-colors ${ci.es_obligatoria ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                                                    {ci.es_obligatoria ? 'Obligatoria' : 'Opcional'}
                                                </Badge>
                                            </div>
                                            {ci.completada && (
                                                <div className="mt-1.5">
                                                    <Input placeholder="Observación (opcional)…" value={ci.observacion || ''} disabled={readOnly}
                                                        onChange={(e) => setObservacion(ci.actividad_id, e.target.value)}
                                                        className="h-7 text-xs bg-white border-[#E2E8F0] disabled:opacity-100 disabled:bg-slate-50" />
                                                </div>
                                            )}
                                        </div>
                                    </label>
                                </div>
                            )
                        })}
                    </div>
                    {errors?.checklist && <p className="text-[10px] text-red-500 font-medium">{errors.checklist.message}</p>}
                </div>
            )}
        </div>
    )
}

// ── PASO 3 — Insumos
function Paso3({ datos, onChange, insumos, readOnly, errors }: { datos: WizardDatos; onChange: (d: Partial<WizardDatos>) => void; insumos: Insumo[]; readOnly?: boolean; errors?: any }) {
    return (
        <div className="space-y-6">
            <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#1E40AF]" />
                Insumos y Repuestos
            </h2>

            {/* Insumos usados */}
            <InsumoSelector
                tipo="usado"
                items={datos.insumos_usados}
                catalogo={insumos}
                readOnly={readOnly}
                errors={errors?.insumos_usados}
                onAdd={(item: any) => {
                    const insumo_id = item.insumo_id || ''
                    const existing = datos.insumos_usados.find(i => i.insumo_id === insumo_id)
                    const newItem: InsumoItem = {
                        uid: item.uid || crypto.randomUUID(),
                        insumo_id,
                        nombre: item.nombre || '',
                        codigo: item.codigo || null,
                        unidad: item.unidad || '',
                        cantidad: item.cantidad || 1,
                        es_nuevo: !!item.es_nuevo
                    }
                    if (existing) {
                        onChange({
                            insumos_usados: datos.insumos_usados.map(i => 
                                i.insumo_id === insumo_id ? { ...i, cantidad: i.cantidad + 1 } : i
                            )
                        })
                    } else {
                        onChange({ insumos_usados: [...datos.insumos_usados, newItem] })
                    }
                }}
                onRemove={(uid) => onChange({ insumos_usados: datos.insumos_usados.filter(i => i.uid !== uid) })}
                onChange={(uid, updates) => onChange({
                    insumos_usados: datos.insumos_usados.map(i => i.uid === uid ? { ...i, ...updates } : i)
                })}
            />

            <div className="h-px bg-[#F1F5F9]" />

            {/* Insumos requeridos */}
            <InsumoSelector
                tipo="requerido"
                items={datos.insumos_requeridos}
                catalogo={insumos}
                readOnly={readOnly}
                errors={errors?.insumos_requeridos}
                onAdd={(item: any) => {
                    const insumo_id = item.insumo_id || ''
                    const existing = datos.insumos_requeridos.find(i => i.insumo_id === insumo_id)
                    const newItem: InsumoReqItem = {
                        uid: item.uid || crypto.randomUUID(),
                        insumo_id,
                        nombre: item.nombre || '',
                        codigo: item.codigo || null,
                        unidad: item.unidad || '',
                        cantidad: item.cantidad || 1,
                        es_nuevo: !!item.es_nuevo,
                        motivo: item.motivo || ''
                    }
                    if (existing) {
                        onChange({
                            insumos_requeridos: datos.insumos_requeridos.map(i => 
                                i.insumo_id === insumo_id ? { ...i, cantidad: i.cantidad + 1 } : i
                            )
                        })
                    } else {
                        onChange({ insumos_requeridos: [...datos.insumos_requeridos, newItem] })
                    }
                }}
                onRemove={(uid) => onChange({ insumos_requeridos: datos.insumos_requeridos.filter(i => i.uid !== uid) })}
                onChange={(uid, updates) => onChange({
                    insumos_requeridos: datos.insumos_requeridos.map(i => i.uid === uid ? { ...i, ...updates } : i)
                })}
            />

            {/* ── Accesorios / Repuestos ── */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-[#334155]">Accesorios / Repuestos</Label>
                    {!readOnly && (
                        <button type="button"
                            onClick={() => onChange({
                                accesorios: [...datos.accesorios, {
                                    uid: crypto.randomUUID(),
                                    descripcion: '',
                                    cantidad: 1,
                                    estado_equipo_contexto: 'operativo',
                                }]
                            })}
                            className="flex items-center gap-1 text-xs text-[#1E40AF] font-medium hover:underline">
                            <Plus className="h-3.5 w-3.5" /> Agregar
                        </button>
                    )}
                </div>
                {datos.accesorios.length === 0 ? (
                    <p className="text-xs text-[#94A3B8] text-center py-2 border border-dashed border-[#E2E8F0] rounded-lg">Sin accesorios registrados</p>
                ) : datos.accesorios.map((a, idx) => (
                    <div key={a.uid} className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-[#94A3B8] font-mono">#{idx + 1}</span>
                            {!readOnly && (
                                <button onClick={() => onChange({ accesorios: datos.accesorios.filter(x => x.uid !== a.uid) })}
                                    className="text-[#94A3B8] hover:text-red-500 ml-auto">
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                        <Input placeholder="Descripción del accesorio o repuesto…" value={a.descripcion} disabled={readOnly}
                            onChange={(e) => onChange({ accesorios: datos.accesorios.map(x => x.uid === a.uid ? { ...x, descripcion: e.target.value } : x) })}
                            className={`h-9 text-xs border-[#E2E8F0] disabled:opacity-100 disabled:bg-slate-50 ${errors?.accesorios?.[idx]?.descripcion ? 'border-red-500' : ''}`} />
                        {errors?.accesorios?.[idx]?.descripcion && <p className="text-[10px] text-red-500 font-medium">{errors.accesorios[idx].descripcion.message}</p>}
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <Select value={a.estado_equipo_contexto} disabled={readOnly}
                                    onValueChange={(v) => onChange({ accesorios: datos.accesorios.map(x => x.uid === a.uid ? { ...x, estado_equipo_contexto: v as AccesorioItem['estado_equipo_contexto'] } : x) })}>
                                    <SelectTrigger className="h-9 text-xs bg-white border-[#E2E8F0] disabled:opacity-100 disabled:bg-slate-50">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="operativo">Operativo</SelectItem>
                                        <SelectItem value="restringido">Restringido</SelectItem>
                                        <SelectItem value="no_operativo">No operativo</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-1 items-end">
                                <Input type="number" min={1} value={a.cantidad} disabled={readOnly}
                                    onChange={(e) => onChange({ accesorios: datos.accesorios.map(x => x.uid === a.uid ? { ...x, cantidad: Number(e.target.value) } : x) })}
                                    className={`h-9 w-16 text-center text-xs border-[#E2E8F0] disabled:opacity-100 disabled:bg-slate-50 ${errors?.accesorios?.[idx]?.cantidad ? 'border-red-500' : ''}`} />
                                {errors?.accesorios?.[idx]?.cantidad && <p className="text-[10px] text-red-500 font-medium">{errors.accesorios[idx].cantidad.message}</p>}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── PASO 4 — Revisión + Firma
function Paso4({ datos, equipo, tecnicos, tecnicoActual, firmaRef, firmaSaved, setFirmaSaved, readOnly, errors, tiposMantenimiento, onFirmarEnviar }: {
    datos: WizardDatos;
    equipo: any;
    tecnicos: TecnicoData[];
    tecnicoActual: TecnicoData | null;
    firmaRef: React.MutableRefObject<SignatureCanvasType | null>;
    firmaSaved: boolean;
    setFirmaSaved: (s: boolean) => void;
    readOnly?: boolean;
    errors?: any;
    tiposMantenimiento: TipoMantenimiento[];
    onFirmarEnviar: () => void;
}) {

    const tipoNombre = tiposMantenimiento.find((t) => t.id === datos.tipo_mantenimiento_id)?.nombre ?? '—'
    const estadoPost = ESTADOS_EQUIPO_POST.find((e) => e.value === datos.estado_equipo_post)
    const completadas = datos.checklist.filter((c) => c.completada).length

    return (
        <div className="space-y-5" id="paso4-revision-firma">
            <h2 className="text-sm font-semibold text-[#0F172A]">Revisión y firma</h2>

            {/* Resumen */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-3 text-xs">
                <p className="text-xs font-semibold text-[#334155] uppercase tracking-wide">Resumen del reporte</p>
                <div className="grid grid-cols-2 gap-y-2 gap-x-3">
                    <div>
                        <p className="text-[#94A3B8]">Equipo</p>
                        <p className="font-semibold text-[#1E40AF] font-mono">{equipo?.codigo_mh}</p>
                    </div>
                    <div>
                        <p className="text-[#94A3B8]">Tipo</p>
                        <p className="font-medium text-[#334155]">{tipoNombre}</p>
                    </div>
                    <div>
                        <p className="text-[#94A3B8]">Fecha</p>
                        <p className="font-medium text-[#334155]">{datos.fecha_ejecucion}</p>
                    </div>
                    <div>
                        <p className="text-[#94A3B8]">Estado post</p>
                        {estadoPost
                            ? <Badge className={`text-[10px] px-2 py-0.5 border ${estadoPost.cls}`}>{estadoPost.label}</Badge>
                            : <span className="text-[#94A3B8]">—</span>}
                    </div>
                    <div>
                        <p className="text-[#94A3B8]">Checklist</p>
                        <p className="font-medium text-[#334155]">{completadas}/{datos.checklist.length}</p>
                    </div>
                    <div>
                        <p className="text-[#94A3B8]">Insumos usados</p>
                        <p className="font-medium text-[#334155]">{datos.insumos_usados.length}</p>
                    </div>
                </div>
                {datos.trabajo_realizado && (
                    <div className="pt-1 border-t border-[#E2E8F0]">
                        <p className="text-[#94A3B8] mb-0.5">Trabajo realizado</p>
                        <p className="text-[#334155] line-clamp-3">{datos.trabajo_realizado}</p>
                    </div>
                )}
                <div className="pt-1 border-t border-[#E2E8F0]">
                    <div className="flex items-center gap-2">
                        <HardHat className="h-3 w-3 text-[#94A3B8]" />
                        <p className="text-[#334155] font-medium">{tecnicoActual?.nombre} {tecnicoActual?.apellido}</p>
                    </div>
                    {datos.tecnicos_apoyo.length > 0 && (
                        <p className="text-[#94A3B8] mt-0.5">
                            Apoyo: {datos.tecnicos_apoyo.map((id) => {
                                const t = tecnicos.find((x) => x.id === id)
                                return t ? `${t.nombre} ${t.apellido}` : ''
                            }).join(', ')}
                        </p>
                    )}
                </div>
            </div>

            {/* Canvas de firma */}
            {!readOnly && (
                <>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium text-[#334155]">Firma digital del técnico</Label>
                            {firmaSaved && (
                                <span className="flex items-center gap-1 text-[10px] text-green-700 font-medium">
                                    <CheckCircle2 className="h-3 w-3" /> Firmado
                                </span>
                            )}
                        </div>
                        <div id="canvas-firma-tecnico" className={`rounded-xl border-2 border-dashed bg-[#F8FAFC] overflow-hidden cursor-crosshair
                            ${errors?.firma_tecnico ? 'border-red-500 bg-red-50' : 'border-[#CBD5E1]'}`}
                            style={{ touchAction: 'none' }}>
                            <SignaturePad
                                padRef={firmaRef}
                                onEnd={() => {
                                    setFirmaSaved(true);
                                    if (firmaRef.current) {
                                        // No lo guardamos en el estado de WizardDatos aún para evitar re-renders masivos
                                        // pero marcamos que existe
                                    }
                                }}
                            />
                        </div>
                        {errors?.firma_tecnico && <p className="text-[10px] text-red-500 font-medium text-center">{errors.firma_tecnico.message}</p>}
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" size="sm"
                                onClick={() => { firmaRef.current?.clear(); setFirmaSaved(false) }}
                                className="flex-1 h-8 text-xs text-[#334155]">
                                Limpiar firma
                            </Button>
                        </div>
                        <p className="text-[10px] text-[#94A3B8] text-center">
                            Firma sobre el área usando tu dedo o lápiz táctil
                        </p>
                    </div>

                    {/* Botones finales */}
                    <div className="space-y-2 pt-2">
                        <Button onClick={onFirmarEnviar} disabled={!firmaSaved}
                            className="w-full h-12 bg-[#1E40AF] hover:bg-[#1E3A8A] text-white gap-2 font-semibold"
                            id="btn-firmar-enviar">
                            <FileCheck className="h-4 w-4" />
                            {firmaSaved ? 'Firmar y enviar reporte' : 'Agrega tu firma para enviar'}
                        </Button>
                    </div>
                </>
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL — Wizard BLOQUE 3 (datos reales)
// ═══════════════════════════════════════════════════════════════

interface EquipoData {
    id: string
    codigo_mh: string
    nombre: string
    marca: string | null
    modelo: string | null
    numero_serie: string | null
    categoria_id: string | null
    categoria?: { id: string; nombre: string } | null
}

interface ContratoVigenteData {
    numero_contrato: string
    cliente_nombre: string | null
}

interface TecnicoData {
    id: string
    nombre: string
    apellido: string
}

export default function NuevoReporteWizard() {
    const { equipoId } = useParams<{ equipoId: string }>()
    const router = useRouter()
    const searchParams = useSearchParams()
    const draftReporteId = searchParams.get('reporteId')
    const modoLectura = searchParams.get('modo') === 'lectura'

    const firmaRef = useRef<SignatureCanvasType | null>(null)
    const firmaClienteRef = useRef<SignatureCanvasType | null>(null)
    const [firmaSaved, setFirmaSaved] = useState(false)
    const [modalExitOpen, setModalExitOpen] = useState(false)
    const [firmaClienteSaved, setFirmaClienteSaved] = useState(false)
    const [paso, setPaso] = useState(1)
    const [isPending, startTransition] = useTransition()

    // ── Datos del equipo y contexto (cargados desde Supabase)
    const [equipo, setEquipo] = useState<EquipoData | null>(null)
    const [contratoVigente, setContratoVigente] = useState<ContratoVigenteData | null>(null)
    const [tecnicos, setTecnicos] = useState<TecnicoData[]>([])
    const [tiposMantenimiento, setTiposMantenimiento] = useState<TipoMantenimiento[]>([])
    const [ubicaciones, setUbicaciones] = useState<UbicacionConCliente[]>([])
    const [insumos, setInsumos] = useState<Insumo[]>([])
    const [tecnicoActual, setTecnicoActual] = useState<TecnicoData | null>(null)
    const [checklistTemplate, setChecklistTemplate] = useState<any[]>([])
    const [reporteId, setReporteId] = useState<string | null>(draftReporteId)

    const [ultimoPreventivo, setUltimoPreventivo] = useState<string | null>(null)
    const [cargandoContexto, setCargandoContexto] = useState(true)
    const initPasoUrl = parseInt(searchParams.get('paso') || '0', 10)

    // ── Bandera modo Solo-Avanzar (no permite Volver cuando ya no es borrador)
    const [soloAvanzar, setSoloAvanzar] = useState(false)

    // ── Nombre del firmante cliente (para PASO 5)
    const [nombreFirmante, setNombreFirmante] = useState('')

    // ── Estado de errores y carga
    const [errorGlobal, setErrorGlobal] = useState<string | null>(null)

    // ── Inicializar React Hook Form
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        trigger,
        control,
        reset,
        formState: { errors }
    } = useForm<WizardDatos>({
        resolver: zodResolver(wizardSchema),
        defaultValues: {
            tipo_mantenimiento_id: '',
            fecha_ejecucion: hoy(),
            hora_entrada: new Date().toTimeString().slice(0, 5),
            hora_salida: '',
            ciudad: 'Guayaquil',
            solicitado_por: '',
            motivo_visita: '',
            numero_reporte_fisico: '',
            ubicacion_id: '',
            ubicacion_detalle: '',
            tecnicos_apoyo: [],
            equipo_marca_snapshot: '',
            equipo_modelo_snapshot: '',
            equipo_serie_snapshot: '',
            diagnostico: '',
            trabajo_realizado: '',
            estado_equipo_post: 'operativo',
            checklist: [],
            insumos_usados: [],
            insumos_requeridos: [],
            accesorios: [],
        }
    })

    const datos = watch()
    function update(d: Partial<WizardDatos>) {
        Object.entries(d).forEach(([key, val]) => {
            setValue(key as keyof WizardDatos, val as any)
        })
    }

    // ── Cargar contexto real desde Supabase al montar
    useEffect(() => {
        async function cargarContexto() {
            setCargandoContexto(true)
            try {
                const { getEquipoById } = await import('@/app/actions/equipos')
                const { getTecnicos } = await import('@/app/actions/tecnicos')
                const { getReporteBorradorData, getUltimoMantenimientoPreventivo } = await import('@/app/actions/reportes')
                const supabaseModule = await import('@/lib/supabase/client').catch(() => null)

                const promesas: any[] = [
                    getEquipoById(equipoId),
                    getTecnicos({ activo: true }),
                    getUltimoMantenimientoPreventivo(equipoId)
                ]

                if (draftReporteId) {
                    promesas.push(getReporteBorradorData(draftReporteId))
                } else {
                    promesas.push(Promise.resolve(null))
                }

                if (supabaseModule) {
                    const sb = supabaseModule.createClient()
                    promesas.push(sb.auth.getUser())
                } else {
                    promesas.push(Promise.resolve({ data: { user: null } }))
                }

                const [eqRes, tecsRes, prevRes, draftRes, authRes] = await Promise.all(promesas)

                if (prevRes?.data) {
                    setUltimoPreventivo(prevRes.data)
                }

                if (eqRes?.data) {
                    setEquipo(eqRes.data as any)
                    setContratoVigente(eqRes.data.contrato_vigente as any)
                    if (eqRes.data.checklist_template) {
                        setChecklistTemplate(eqRes.data.checklist_template)
                    }
                }

                if (tecsRes?.data) {
                    setTecnicos(tecsRes.data as TecnicoData[])
                    if (authRes?.data?.user) {
                        const { data: tc } = await supabaseModule!.createClient()
                            .from('tecnicos')
                            .select('id, nombre, apellido')
                            .eq('user_id', authRes.data.user.id)
                            .single()
                        if (tc) setTecnicoActual(tc)
                    }
                }

                // Cargar tipos, ubicaciones e insumos asegurandonos de tener el cliente si aplica
                const clienteId = (eqRes?.data as any)?.contrato_vigente?.cliente_id
                    || (eqRes?.data as any)?.cliente_id
                    || undefined
                console.log('[cargarContexto] clienteId:', clienteId)
                const [tiposRes, ubicasRes, insumosRes] = await Promise.all([
                    getTiposMantenimiento(),
                    getUbicaciones(clienteId),
                    getInsumos({ activo: true })
                ])

                if (tiposRes.data) setTiposMantenimiento(tiposRes.data)
                if (ubicasRes.data) setUbicaciones(ubicasRes.data)
                if (insumosRes.data) setInsumos(insumosRes.data)

                // Initialize draft data if it exists
                if (draftRes?.data) {
                    const r = draftRes.data;
                    console.log('[cargarContexto] hora_salida raw:', r.hora_salida, '| estado:', r.estado_reporte)
                    // Primera actualización: campos que no dependen de otros selects cargados
                    update({
                        tipo_mantenimiento_id: r.tipo_mantenimiento_id || '',
                        fecha_ejecucion: r.fecha_inicio ? r.fecha_inicio.split('T')[0] : hoy(),
                        hora_entrada: r.hora_entrada || '',
                        hora_salida: r.hora_salida ? r.hora_salida.slice(0, 5) : '',
                        ciudad: r.ciudad || '',
                        solicitado_por: r.solicitado_por || '',
                        motivo_visita: r.motivo_visita || '',
                        numero_reporte_fisico: r.numero_reporte_fisico || '',
                        diagnostico: r.diagnostico || '',
                        trabajo_realizado: r.trabajo_realizado || '',
                        estado_equipo_post: r.estado_equipo_post || 'operativo',
                        equipo_marca_snapshot: r.equipo_marca_snapshot || '',
                        equipo_modelo_snapshot: r.equipo_modelo_snapshot || '',
                        equipo_serie_snapshot: r.equipo_serie_snapshot || '',
                        checklist: r.checklist || [] // Cargar checklist guardado
                    })

                    // Guardar ubicacion_id para restaurar después de cargar las ubicaciones
                    const _ubicacionId = r.ubicacion_id || ''
                    const _ubicacionDetalle = r.ubicacion_detalle || ''

                    // Cargar técnicos de apoyo
                    const { data: tecApoyo } = await supabaseModule!.createClient()
                        .from('reporte_tecnicos')
                        .select('tecnico_id')
                        .eq('reporte_id', draftReporteId)
                        .eq('rol', 'apoyo')
                    if (tecApoyo && tecApoyo.length > 0) {
                        update({ tecnicos_apoyo: tecApoyo.map((t: any) => t.tecnico_id) })
                    }

                    // Cargar insumos usados
                    const { data: insUsados } = await supabaseModule!.createClient()
                        .from('reporte_insumos_usados')
                        .select('insumo_id, cantidad, insumo:insumos(nombre, codigo, unidad_medida)')
                        .eq('reporte_id', draftReporteId)
                    if (insUsados && insUsados.length > 0) {
                        update({
                            insumos_usados: insUsados.map((i: any) => ({
                                uid: crypto.randomUUID(),
                                insumo_id: i.insumo_id,
                                nombre: i.insumo?.nombre || '',
                                codigo: i.insumo?.codigo || null,
                                unidad: i.insumo?.unidad_medida || '',
                                cantidad: i.cantidad,
                                es_nuevo: false,
                            }))
                        })
                    }

                    // Cargar insumos requeridos
                    const { data: insReq } = await supabaseModule!.createClient()
                        .from('reporte_insumos_requeridos')
                        .select('insumo_id, cantidad, observacion, insumo:insumos(nombre, codigo, unidad_medida)')
                        .eq('reporte_id', draftReporteId)
                    if (insReq && insReq.length > 0) {
                        update({
                            insumos_requeridos: insReq.map((i: any) => ({
                                uid: crypto.randomUUID(),
                                insumo_id: i.insumo_id,
                                nombre: i.insumo?.nombre || '',
                                codigo: i.insumo?.codigo || null,
                                unidad: i.insumo?.unidad_medida || '',
                                cantidad: i.cantidad,
                                es_nuevo: false,
                                motivo: i.observacion || '',
                            }))
                        })
                    }

                    // Cargar accesorios
                    const { data: accs } = await supabaseModule!.createClient()
                        .from('reporte_accesorios')
                        .select('descripcion, cantidad, estado_equipo_contexto')
                        .eq('reporte_id', draftReporteId)
                    if (accs && accs.length > 0) {
                        update({
                            accesorios: accs.map((a: any) => ({
                                uid: crypto.randomUUID(),
                                descripcion: a.descripcion,
                                cantidad: a.cantidad,
                                estado_equipo_contexto: a.estado_equipo_contexto,
                            }))
                        })
                    }

                    // Segunda actualización: campos que dependen de datos ya cargados
                    // Se ejecuta DESPUÉS de setUbicaciones para que el <Select> encuentre la opción
                    if (_ubicacionId) {
                        update({
                            ubicacion_id: _ubicacionId,
                            ubicacion_detalle: _ubicacionDetalle,
                        })
                    }
                    // Check if it's already past the draft stage (e.g., pending_firma)
                    // Con la Migración 1, el estado inicial es 'en_progreso'. 'borrador' se mantiene por retrocompatibilidad.
                    if (r.estado_reporte !== 'borrador' && r.estado_reporte !== 'en_progreso') {
                        setSoloAvanzar(true)
                    }

                    // Go to Step defined by URL or fallback to Step 2 if user selected Continue Draft without explicitly requesting another step
                    if (initPasoUrl >= 1 && initPasoUrl <= 4) {
                        setPaso(initPasoUrl)
                    } else {
                        setPaso(2)
                    }
                }
            } catch (e) {
                console.error('Error cargando contexto:', e)
            } finally {
                setCargandoContexto(false)
            }
        }
        cargarContexto()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [equipoId, draftReporteId])

    const puedeAvanzar = true // Ahora mediado por trigger() en handleSiguiente

    // PASO 1 → 2: Crear borrador en Supabase
    async function handleAvanzarDesdePaso1() {
        if (!tecnicoActual) {
            setErrorGlobal('No se pudo identificar al técnico actual')
            return
        }
        startTransition(async () => {
            if (reporteId) {
                const { actualizarBorradorReporte } = await import('@/app/actions/reportes')
                const result = await actualizarBorradorReporte(reporteId, {
                    equipo_id: equipoId,
                    tecnico_principal_id: tecnicoActual.id,
                    tipo_mantenimiento_id: datos.tipo_mantenimiento_id,
                    fecha_inicio: datos.fecha_ejecucion,
                    hora_entrada: datos.hora_entrada || null,
                    ciudad: datos.ciudad || null,
                    solicitado_por: datos.solicitado_por || null,
                    motivo_visita: datos.motivo_visita || null,
                    numero_reporte_fisico: datos.numero_reporte_fisico || null,
                    ubicacion_id: datos.ubicacion_id || null,
                    ubicacion_detalle: datos.ubicacion_detalle || null,
                    dispositivo_origen: 'web',
                })
                if (result.error) {
                    setErrorGlobal(result.error)
                    return
                }
                setErrorGlobal(null)
                setPaso(2)
            } else {
                const { createBorradorReporte } = await import('@/app/actions/reportes')
                const result = await createBorradorReporte({
                    equipo_id: equipoId,
                    tecnico_principal_id: tecnicoActual.id,
                    tipo_mantenimiento_id: datos.tipo_mantenimiento_id,
                    fecha_inicio: datos.fecha_ejecucion,
                    hora_entrada: datos.hora_entrada || null,
                    ciudad: datos.ciudad || null,
                    solicitado_por: datos.solicitado_por || null,
                    motivo_visita: datos.motivo_visita || null,
                    numero_reporte_fisico: datos.numero_reporte_fisico || null,
                    ubicacion_id: datos.ubicacion_id || null,
                    ubicacion_detalle: datos.ubicacion_detalle || null,
                    dispositivo_origen: 'web',
                })
                if (result.error) {
                    setErrorGlobal(result.error)
                    return
                }
                setReporteId(result.data!.id)
                setErrorGlobal(null)
                setPaso(2)
            }
        })
    }

    // PASO 2 → 3: Guardar detalle + checklist
    async function handleAvanzarDesdePaso2() {
        if (!reporteId) { setErrorGlobal('Borrador no creado'); return }
        startTransition(async () => {
            const { guardarDetalleReporte } = await import('@/app/actions/reportes')
            const result = await guardarDetalleReporte({
                reporte_id: reporteId,
                diagnostico: datos.diagnostico || null,
                trabajo_realizado: datos.trabajo_realizado || null,
                observaciones: null,
                hora_salida: datos.hora_salida || null,
                estado_equipo_post: datos.estado_equipo_post as 'operativo' | 'restringido' | 'no_operativo' | 'almacenado' | 'dado_de_baja',
                actividades: datos.checklist.map((c) => ({
                    actividad_id: c.actividad_id,
                    completada: c.completada,
                    observacion: c.observacion || null,
                })),
            })
            if (result.error) { setErrorGlobal(result.error); return }
            setErrorGlobal(null)
            setPaso(3)
        })
    }

    // PASO 3 → 4: Guardar insumos, accesorios y técnicos
    async function handleAvanzarDesdePaso3() {
        if (!reporteId) { setErrorGlobal('Borrador no creado'); return }
        startTransition(async () => {
            const { guardarInsumosTecnicos } = await import('@/app/actions/reportes')
            const result = await guardarInsumosTecnicos({
                reporte_id: reporteId,
                insumos_usados: datos.insumos_usados.map((i) => ({
                    insumo_id: i.insumo_id,
                    nombre: i.nombre,
                    cantidad: i.cantidad,
                    es_nuevo: i.es_nuevo,
                    observacion: null,
                })),
                insumos_requeridos: datos.insumos_requeridos.map((i) => ({
                    insumo_id: i.insumo_id,
                    nombre: i.nombre,
                    cantidad: i.cantidad,
                    es_nuevo: i.es_nuevo,
                    urgente: false,
                    observacion: (i as any).motivo || null,
                })),
                accesorios: datos.accesorios.map((a) => ({
                    descripcion: a.descripcion,
                    cantidad: a.cantidad,
                    estado_equipo_contexto: a.estado_equipo_contexto,
                })),
                tecnicos_apoyo: datos.tecnicos_apoyo.map((id) => ({ tecnico_id: id })),
            })
            if (result.error) { setErrorGlobal(result.error); return }
            setErrorGlobal(null)
            setPaso(4)
        })
    }

    // PASO 4a: Firma técnico → estado: pendiente_firma_cliente
    async function handleFirmarTecnico(): Promise<boolean> {
        if (!reporteId || !firmaRef.current) return false
        const base64 = firmaRef.current.toDataURL('image/png')
        const { firmarComoTecnico } = await import('@/app/actions/reportes')
        const result = await firmarComoTecnico({ reporte_id: reporteId, firma_base64: base64 })
        if (result.error) { setErrorGlobal(result.error); return false }
        setErrorGlobal(null)
        return true
    }

    // PASO 4b (= PASO 5): Firma cliente → cerrar reporte
    async function handleFirmarEnviar() {
        if (!reporteId) { setErrorGlobal('Reporte no encontrado'); return }
        if (!firmaSaved) { setErrorGlobal('Primero firma como técnico'); return }

        startTransition(async () => {
            // Paso 4: firma técnico
            const tecnicoOk = await handleFirmarTecnico()
            if (!tecnicoOk) return

            // Paso 5: firma cliente (si hay canvas de cliente)
            if (firmaClienteRef.current && firmaClienteSaved) {
                const base64Cliente = firmaClienteRef.current.toDataURL('image/png')
                const { firmarComoCliente } = await import('@/app/actions/reportes')
                const result = await firmarComoCliente({
                    reporte_id: reporteId,
                    firma_base64: base64Cliente,
                    nombre_firmante: nombreFirmante || 'Cliente',
                })
                if (result.error) { setErrorGlobal(result.error); return }
            } else {
                // Si no hay firma de cliente todavía, solo quedamos en pendiente_firma_cliente
                setErrorGlobal(null)
                alert('Firma del técnico guardada. El reporte queda en espera de firma del cliente.')
                router.push('/tecnico/mis-reportes')
                return
            }

            setErrorGlobal(null)
            router.push('/tecnico/mis-reportes?nueva=1')
        })
    }

    async function handleGuardarBorrador() {
        if (!navigator.onLine) {
            // ... (logica offline existente omitida por brevedad en multi replace o re-ejecutada literal)
            const { guardarReporteOffline } = await import('@/lib/offline/db')
            await guardarReporteOffline({
                id: reporteId || crypto.randomUUID(),
                equipo_id: equipoId,
                tecnico_principal_id: tecnicoActual?.id || '',
                tipo_mantenimiento_id: datos.tipo_mantenimiento_id || '',
                fecha_inicio: datos.fecha_ejecucion,
                hora_entrada: datos.hora_entrada,
                hora_salida: datos.hora_salida,
                ciudad: datos.ciudad,
                solicitado_por: datos.solicitado_por,
                motivo_visita: datos.motivo_visita,
                numero_reporte_fisico: datos.numero_reporte_fisico,
                diagnostico: datos.diagnostico,
                trabajo_realizado: datos.trabajo_realizado,
                estado_equipo_post: datos.estado_equipo_post,
                actividades: datos.checklist,
                insumos_usados: datos.insumos_usados,
                insumos_requeridos: datos.insumos_requeridos,
                accesorios: datos.accesorios,
                tecnicos_apoyo: datos.tecnicos_apoyo,
            })
            alert('Sin conexión. Reporte guardado localmente. Se sincronizará automáticamente.')
            return
        }

        if (!reporteId) {
            alert('Completa el paso 1 para guardar el borrador en base de datos.')
            return
        }

        startTransition(async () => {
            const { guardarBorradorGlobal } = await import('@/app/actions/reportes')
            const re = await guardarBorradorGlobal({
                reporte_id: reporteId,
                tipo_mantenimiento_id: datos.tipo_mantenimiento_id,
                fecha_inicio: datos.fecha_ejecucion,
                diagnostico: datos.diagnostico,
                trabajo_realizado: datos.trabajo_realizado,
                estado_equipo_post: datos.estado_equipo_post as any,
                hora_entrada: datos.hora_entrada,
                hora_salida: datos.hora_salida,
                ciudad: datos.ciudad,
                solicitado_por: datos.solicitado_por,
                motivo_visita: datos.motivo_visita,
                numero_reporte_fisico: datos.numero_reporte_fisico,
                ubicacion_id: datos.ubicacion_id || null,
                ubicacion_detalle: datos.ubicacion_detalle || null,
                tecnicos_apoyo: datos.tecnicos_apoyo
            })
            if (re.error) {
                setErrorGlobal('No se pudo guardar avance: ' + re.error)
            } else {
                router.push('/tecnico/dashboard')
            }
        })
    }

    // ── Mientras carga contexto
    if (cargandoContexto) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1E40AF] border-t-transparent" />
                <p className="text-sm text-[#94A3B8]">Cargando equipo…</p>
            </div>
        )
    }

    if (!equipo) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <AlertTriangle className="h-10 w-10 text-amber-400" />
                <p className="text-sm font-semibold text-[#0F172A]">Equipo no encontrado</p>
                <Button variant="outline" onClick={() => router.push('/tecnico/nuevo-reporte')}>Volver</Button>
            </div>
        )
    }

    const equipoDisplay = equipo
    const contratoDisplay = contratoVigente

    // Auto-fill snapshots desde equipo real
    if (equipo && !datos.equipo_marca_snapshot) {
        update({
            equipo_marca_snapshot: equipo.marca ?? '',
            equipo_modelo_snapshot: equipo.modelo ?? '',
            equipo_serie_snapshot: equipo.numero_serie ?? '',
        })
    }

    async function handleSiguiente() {
        if (modoLectura) {
            setPaso(p => p + 1)
            return
        }

        setErrorGlobal(null)

        if (paso === 1) {
            const ok = await trigger(['tipo_mantenimiento_id', 'fecha_ejecucion', 'motivo_visita', 'ciudad', 'solicitado_por', 'hora_entrada', 'ubicacion_id'])
            if (!ok) return

            if (!tecnicoActual) {
                setErrorGlobal("Identidad del técnico no detectada, no se puede continuar.")
                return;
            }

            handleAvanzarDesdePaso1()
            return
        }
        if (paso === 2) {
            const ok = await trigger(['diagnostico', 'trabajo_realizado', 'estado_equipo_post', 'checklist'])
            if (!ok) return
            handleAvanzarDesdePaso2()
            return
        }
        if (paso === 3) {
            const ok = await trigger(['insumos_usados'])
            if (!ok) return
            handleAvanzarDesdePaso3()
            return
        }
        if (paso === 4) {
            // Validar firma del técnico
            const base64 = firmaRef.current?.isEmpty() ? null : firmaRef.current?.toDataURL()
            if (!base64) {
                setErrorGlobal("Debe firmar el reporte antes de enviar")
                setValue('firma_tecnico', null) // Set to null to trigger validation error
                await trigger('firma_tecnico') // Manually trigger validation for firma_tecnico
                return
            }
            update({ firma_tecnico: base64 })
            
            const ok = await trigger(['firma_tecnico'])
            if (!ok) return

            handleFirmarEnviar()
            return
        }
        setPaso(p => p + 1)
    }

    return (
        <div className="space-y-4">
            {/* Header: Volver + X */}
            <div className="flex items-center justify-between">
                {!soloAvanzar ? (
                    <button onClick={() => paso === 1 ? router.push('/tecnico/nuevo-reporte') : setPaso(p => p - 1)}
                        className="flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-[#334155] -ml-1">
                        <ArrowLeft className="h-4 w-4" />
                        {paso === 1 ? 'Cambiar equipo' : 'Paso anterior'}
                    </button>
                ) : (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 -ml-1">
                        <AlertTriangle className="h-4 w-4" /> Modo solo-avanzar (Firmas)
                    </div>
                )}
                <button onClick={() => {
                    if (modoLectura) {
                        router.push(`/tecnico/mis-reportes/${reporteId}`)
                    } else {
                        setModalExitOpen(true)
                    }
                }}
                    className="flex items-center justify-center p-1.5 text-[#94A3B8] hover:text-[#0F172A] hover:bg-slate-100 rounded-lg transition-colors">
                    <X className="h-5 w-5" />
                </button>
            </div>

            {/* Equipo seleccionado */}
            <div className="rounded-xl border border-[#1E40AF]/20 bg-blue-50/40 px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <p className="text-xs font-mono font-bold text-[#1E40AF]">{equipoDisplay.codigo_mh}</p>
                        <p className="text-sm font-semibold text-[#0F172A] leading-tight">{equipoDisplay.nombre}</p>
                        <p className="text-xs text-[#94A3B8]">
                            {equipoDisplay.marca} · {equipoDisplay.modelo} · {contratoDisplay?.cliente_nombre ?? 'Sin contrato'}
                        </p>
                        {ultimoPreventivo && (
                            <p className="text-[10px] text-[#1E40AF] mt-1 font-medium bg-white/50 inline-block px-1.5 py-0.5 rounded border border-[#1E40AF]/10">
                                Último preventivo: {new Date(ultimoPreventivo).toLocaleDateString()}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <Badge className="text-[10px] bg-white text-[#1E40AF] border border-[#1E40AF]/30">Paso {paso} / 4</Badge>
                        {reporteId && (
                            <span className="text-[10px] text-green-600 font-mono bg-green-50 px-1.5 py-0.5 rounded-sm">
                                #{reporteId.slice(0, 8)}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Error global */}
            {errorGlobal && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-600 flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    {errorGlobal}
                </div>
            )}

            {/* Paso indicator */}
            <PasoIndicador paso={paso} total={4} />

            {/* Contenido del paso */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm p-4">
                {paso === 1 && <Paso1 datos={datos} onChange={update} tecnicos={tecnicos} tecnicoActualId={tecnicoActual?.id} tiposMantenimiento={tiposMantenimiento} ubicaciones={ubicaciones} readOnly={modoLectura} errors={errors} />}
                {paso === 2 && <Paso2 datos={datos} onChange={update} readOnly={modoLectura} errors={errors} checklistTemplate={checklistTemplate} />}
                {paso === 3 && <Paso3 datos={datos} onChange={update} insumos={insumos} readOnly={modoLectura} errors={errors} />}
                {paso === 4 && (
                    <Paso4
                        datos={datos}
                        equipo={equipoDisplay}
                        tecnicos={tecnicos}
                        tecnicoActual={tecnicoActual}
                        firmaRef={firmaRef}
                        firmaSaved={firmaSaved}
                        setFirmaSaved={setFirmaSaved}
                        readOnly={modoLectura}
                        errors={errors}
                        tiposMantenimiento={tiposMantenimiento}
                        onFirmarEnviar={handleSiguiente}
                    />
                )}
            </div>

            {/* Botón siguiente (pasos 1-3) */}
            {paso < 4 && (
                <Button onClick={handleSiguiente} disabled={isPending}
                    className="w-full h-12 bg-[#1E40AF] hover:bg-[#1E3A8A] text-white gap-2 font-semibold">
                    {isPending ? (
                        <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Guardando…</>
                    ) : (
                        <>{paso < 3 ? 'Siguiente' : 'Revisar y firmar'}<ChevronRight className="h-4 w-4" /></>
                    )}
                </Button>
            )}

            {/* Modal Salir X */}
            <Dialog open={modalExitOpen} onOpenChange={setModalExitOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>¿Qué deseas hacer con este reporte?</DialogTitle>
                        <DialogDescription>
                            Puedes guardar tu avance para continuar después, o eliminar este reporte permanentemente.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3 pt-4">
                        <Button
                            className="w-full bg-[#1E40AF] hover:bg-[#1E3A8A] text-white gap-2"
                            disabled={isPending}
                            onClick={() => {
                                handleGuardarBorrador()
                            }}>
                            {isPending && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                            Guardar progreso y salir
                        </Button>
                        <Button
                            variant="destructive"
                            className="w-full"
                            onClick={() => {
                                if (reporteId) {
                                    import('@/app/actions/reportes').then(({ eliminarBorradorReporte }) => {
                                        eliminarBorradorReporte(reporteId).then(() => {
                                            router.push('/tecnico/dashboard')
                                        })
                                    })
                                } else {
                                    router.push('/tecnico/dashboard')
                                }
                            }}>
                            Eliminar reporte y salir
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full text-[#64748B]"
                            onClick={() => setModalExitOpen(false)}>
                            Cancelar (Seguir editando)
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

