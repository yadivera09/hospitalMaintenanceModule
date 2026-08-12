'use client'

import { useState, useMemo } from 'react'
import { BarChart2, Clock, TrendingUp, AlertTriangle, InboxIcon, Download, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { exportToExcel } from '@/lib/exportToExcel'
import type { VistaCorrectivosModelo, VistaDuracionIntervencion } from '@/types'

// ── Helpers ────────────────────────────────────────────────────────────────────

function badgeAlerta(nivel: VistaCorrectivosModelo['nivel_alerta']) {
    if (nivel === 'critico') return 'bg-critico-suave text-critico-tinta border-critico-linea border'
    if (nivel === 'alerta') return 'bg-aviso-suave text-aviso-tinta border-aviso-linea border'
    return 'bg-ok-suave text-ok-tinta border-ok-linea border'
}
function labelAlerta(nivel: VistaCorrectivosModelo['nivel_alerta']) {
    if (nivel === 'critico') return 'Crítico'
    if (nivel === 'alerta') return 'Alerta'
    return 'Normal'
}

/** Calcula promedio de duración por tipo sobre el subconjunto filtrado */
function promediosPorTipo(rows: VistaDuracionIntervencion[]) {
    const tipos = Array.from(new Set(rows.map(r => r.nombre_tipo)))
    return tipos.map(tipo => {
        const filas = rows.filter(r => r.nombre_tipo === tipo && r.duracion_minutos != null)
        const avg = filas.reduce((s, r) => s + (r.duracion_minutos ?? 0), 0) / (filas.length || 1)
        return { tipo, count: filas.length, avg: Math.round(avg) }
    })
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ mensaje }: { mensaje: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-borde bg-panel">
            <InboxIcon className="h-8 w-8 text-borde mb-3" />
            <p className="text-sm text-tinta-tenue">{mensaje}</p>
        </div>
    )
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
    correctivos: VistaCorrectivosModelo[]
    duracion: VistaDuracionIntervencion[]
}

// ── Componente ─────────────────────────────────────────────────────────────────

export default function AnalisisClient({ correctivos, duracion }: Props) {
    const [tab, setTab] = useState<'correctivos' | 'duracion'>('correctivos')

    // ── Filtros — Tab Equipos problemáticos ──────────────────────────────────
    const [filtroCategoria, setFiltroCategoria] = useState('todos')
    const [filtroAlerta, setFiltroAlerta] = useState<'todos' | 'critico' | 'alerta' | 'normal'>('todos')

    // ── Filtros — Tab Duración de intervenciones ─────────────────────────────
    const [filtroTipo, setFiltroTipo] = useState<'todos' | 'preventivo' | 'correctivo'>('todos')
    const [filtroTecnico, setFiltroTecnico] = useState('todos')
    const [filtroDesde, setFiltroDesde] = useState('')
    const [filtroHasta, setFiltroHasta] = useState('')

    // ── Listas dinámicas (derivadas de los datos originales sin filtrar) ──────

    const categoriasUnicas = useMemo(() => {
        const set = new Set<string>()
        correctivos.forEach(r => { if (r.nombre_categoria) set.add(r.nombre_categoria) })
        return Array.from(set).sort()
    }, [correctivos])

    const tecnicosUnicos = useMemo(() => {
        const set = new Set<string>()
        duracion.forEach(r => { if (r.tecnico_responsable) set.add(r.tecnico_responsable) })
        return Array.from(set).sort()
    }, [duracion])

    // ── Arrays filtrados ──────────────────────────────────────────────────────

    const correctivosFiltrados = useMemo(() => {
        return correctivos.filter(r => {
            const matchCat = filtroCategoria === 'todos' || r.nombre_categoria === filtroCategoria
            const matchAlerta = filtroAlerta === 'todos' || r.nivel_alerta === filtroAlerta
            return matchCat && matchAlerta
        })
    }, [correctivos, filtroCategoria, filtroAlerta])

    const duracionFiltrada = useMemo(() => {
        return duracion.filter(r => {
            // Filtro por tipo (preventivo vs correctivo)
            const matchTipo =
                filtroTipo === 'todos' ||
                (filtroTipo === 'correctivo'
                    ? r.nombre_tipo.toLowerCase().includes('correctivo')
                    : !r.nombre_tipo.toLowerCase().includes('correctivo'))
            // Filtro por técnico
            const matchTecnico = filtroTecnico === 'todos' || r.tecnico_responsable === filtroTecnico
            // Filtro por rango de fechas
            const fecha = r.fecha_ejecucion ? r.fecha_ejecucion.slice(0, 10) : ''
            const matchDesde = !filtroDesde || fecha >= filtroDesde
            const matchHasta = !filtroHasta || fecha <= filtroHasta
            return matchTipo && matchTecnico && matchDesde && matchHasta
        })
    }, [duracion, filtroTipo, filtroTecnico, filtroDesde, filtroHasta])

    // Promedios recalculados sobre los datos FILTRADOS
    const promediosFiltrados = useMemo(() => promediosPorTipo(duracionFiltrada), [duracionFiltrada])

    // ── Flags de filtros activos ──────────────────────────────────────────────
    const hayFiltrosCorrectivos = filtroCategoria !== 'todos' || filtroAlerta !== 'todos'
    const hayFiltrosDuracion = filtroTipo !== 'todos' || filtroTecnico !== 'todos' || !!filtroDesde || !!filtroHasta

    function limpiarFiltrosCorrectivos() {
        setFiltroCategoria('todos')
        setFiltroAlerta('todos')
    }
    function limpiarFiltrosDuracion() {
        setFiltroTipo('todos')
        setFiltroTecnico('todos')
        setFiltroDesde('')
        setFiltroHasta('')
    }

    // ── Exportar ──────────────────────────────────────────────────────────────
    function handleExportar() {
        if (tab === 'correctivos') {
            exportToExcel(
                correctivosFiltrados.map((r) => ({
                    Marca:                       r.marca,
                    Modelo:                      r.modelo,
                    Categoría:                   r.nombre_categoria,
                    'Total correctivos':          r.total_correctivos,
                    'Equipos afectados':          r.equipos_afectados,
                    'Prom. correctivos/equipo':   r.promedio_correctivos_por_equipo.toFixed(2),
                    'Tipo frecuente':             r.tipo_frecuente ?? '',
                    'Último correctivo':           r.ultimo_correctivo
                        ? new Date(r.ultimo_correctivo).toLocaleDateString('es-EC')
                        : '',
                    Alerta:                      labelAlerta(r.nivel_alerta),
                })),
                'equipos-problematicos'
            )
        } else {
            exportToExcel(
                duracionFiltrada.map((r) => ({
                    'Código MH':    r.codigo_mh,
                    Marca:          r.marca,
                    Modelo:         r.modelo,
                    'Tipo':         r.nombre_tipo,
                    Técnico:        r.tecnico_responsable,
                    'Fecha':        new Date(r.fecha_ejecucion).toLocaleDateString('es-EC'),
                    'Hora entrada': r.hora_entrada ?? '',
                    'Hora salida':  r.hora_salida ?? '',
                    'Duración (min)': r.duracion_minutos ?? '',
                })),
                'duracion-intervenciones'
            )
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-marca-suave">
                        <BarChart2 className="h-5 w-5 text-marca-tinta" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-tinta">Análisis de reportes</h1>
                        <p className="text-sm text-tinta-tenue">Datos reales — reportes cerrados y pendientes de firma</p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    onClick={handleExportar}
                    className="gap-2 border-marca-linea text-marca-tinta hover:bg-marca-suave shrink-0"
                    id="btn-exportar-analisis"
                >
                    <Download className="h-4 w-4" />
                    Exportar {tab === 'correctivos' ? 'Equipos problemáticos' : 'Duración'}
                </Button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-xl bg-panel-suave p-1 w-fit">
                {([['correctivos', 'Equipos problemáticos'], ['duracion', 'Duración de intervenciones']] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setTab(key)}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${tab === key ? 'bg-panel shadow-sm text-marca-tinta' : 'text-tinta-media hover:text-tinta-media'}`}>
                        {label}
                    </button>
                ))}
            </div>

            {/* ── TAB 1: EQUIPOS PROBLEMÁTICOS ── */}
            {tab === 'correctivos' && (
                <div className="space-y-4">
                    {/* Leyenda de colores */}
                    <div className="flex flex-wrap gap-2 text-xs text-tinta-media">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> Crítico — por encima de avg + desviación estándar</span>
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /> Alerta — por encima del promedio</span>
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" /> Normal — por debajo del promedio</span>
                    </div>

                    {/* ── Filtros de equipos problemáticos */}
                    <div className="flex flex-wrap items-center gap-3">
                        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                            <SelectTrigger className="w-52 h-9 bg-panel border-borde" id="filtro-cat-correctivos">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todas las categorías</SelectItem>
                                {categoriasUnicas.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={filtroAlerta} onValueChange={(v) => setFiltroAlerta(v as typeof filtroAlerta)}>
                            <SelectTrigger className="w-44 h-9 bg-panel border-borde" id="filtro-alerta-correctivos">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos los niveles</SelectItem>
                                <SelectItem value="critico">
                                    <span className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-red-500 inline-block shrink-0" />
                                        Crítico
                                    </span>
                                </SelectItem>
                                <SelectItem value="alerta">
                                    <span className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-amber-400 inline-block shrink-0" />
                                        Alerta
                                    </span>
                                </SelectItem>
                                <SelectItem value="normal">
                                    <span className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-green-500 inline-block shrink-0" />
                                        Normal
                                    </span>
                                </SelectItem>
                            </SelectContent>
                        </Select>

                        {hayFiltrosCorrectivos && (
                            <Button variant="ghost" size="sm" onClick={limpiarFiltrosCorrectivos}
                                className="h-9 gap-1.5 text-xs text-tinta-tenue hover:text-tinta-media">
                                <X className="h-3.5 w-3.5" /> Limpiar filtros
                            </Button>
                        )}

                        {/* Contador de resultados */}
                        <span className="text-xs text-tinta-tenue ml-auto">
                            {correctivosFiltrados.length} de {correctivos.length} modelos
                        </span>
                    </div>

                    {correctivos.length === 0 ? (
                        <EmptyState mensaje="No hay reportes cerrados o pendientes de firma registrados." />
                    ) : correctivosFiltrados.length === 0 ? (
                        <EmptyState mensaje="Ningún modelo coincide con los filtros aplicados." />
                    ) : (
                        <>
                            <div className="rounded-xl border border-borde bg-panel overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-borde bg-panel-suave">
                                                {['Marca', 'Modelo', 'Categoría', 'Total', 'Equipos', 'Prom./equipo', 'Tipo frecuente', 'Último', 'Alerta'].map(h => (
                                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-tinta-media uppercase tracking-wide whitespace-nowrap">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {correctivosFiltrados.map((row, i) => (
                                                <tr key={i} className="border-b border-borde-suave hover:bg-panel-suave transition-colors">
                                                    <td className="px-4 py-3 font-medium text-tinta-media">{row.marca}</td>
                                                    <td className="px-4 py-3 text-tinta-media">{row.modelo}</td>
                                                    <td className="px-4 py-3 text-tinta-media">{row.nombre_categoria}</td>
                                                    <td className="px-4 py-3">
                                                        <span className="font-bold text-tinta">{row.total_correctivos}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-tinta-media">{row.equipos_afectados}</td>
                                                    <td className="px-4 py-3 text-tinta-media">{row.promedio_correctivos_por_equipo.toFixed(2)}</td>
                                                    <td className="px-4 py-3">
                                                        {row.tipo_frecuente && row.tipo_frecuente !== '—' ? (
                                                            <Badge className={`text-[11px] px-2 py-0.5 ${row.tipo_frecuente.toLowerCase().includes('correctivo') ? 'bg-critico-suave text-critico-tinta border-critico-linea border' : 'bg-marca-suave text-marca-tinta border-marca-linea border'}`}>
                                                                {row.tipo_frecuente}
                                                            </Badge>
                                                        ) : <span className="text-tinta-tenue">—</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-tinta-media whitespace-nowrap">
                                                        {row.ultimo_correctivo
                                                            ? new Date(row.ultimo_correctivo).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })
                                                            : '—'}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Badge className={`text-[11px] px-2 py-0.5 ${badgeAlerta(row.nivel_alerta)}`}>
                                                            {labelAlerta(row.nivel_alerta)}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Contadores de resumen — siempre sobre los datos FILTRADOS */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-xl border border-critico-linea bg-critico-suave p-3 text-center">
                                    <p className="text-2xl font-bold text-critico-tinta">{correctivosFiltrados.filter(r => r.nivel_alerta === 'critico').length}</p>
                                    <p className="text-xs text-critico-tinta mt-0.5">Críticos</p>
                                </div>
                                <div className="rounded-xl border border-aviso-linea bg-aviso-suave p-3 text-center">
                                    <p className="text-2xl font-bold text-aviso-tinta">{correctivosFiltrados.filter(r => r.nivel_alerta === 'alerta').length}</p>
                                    <p className="text-xs text-aviso-tinta mt-0.5">En alerta</p>
                                </div>
                                <div className="rounded-xl border border-ok-linea bg-ok-suave p-3 text-center">
                                    <p className="text-2xl font-bold text-ok-tinta">{correctivosFiltrados.filter(r => r.nivel_alerta === 'normal').length}</p>
                                    <p className="text-xs text-ok-tinta mt-0.5">Normales</p>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── TAB 2: DURACIÓN INTERVENCIONES ── */}
            {tab === 'duracion' && (
                <div className="space-y-4">
                    {duracion.length === 0 ? (
                        <EmptyState mensaje="No hay reportes con hora de entrada y salida registradas." />
                    ) : (
                        <>
                            {/* ── Filtros de duración */}
                            <div className="flex flex-wrap items-center gap-3">
                                {/* Tipo */}
                                <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as typeof filtroTipo)}>
                                    <SelectTrigger className="w-44 h-9 bg-panel border-borde" id="filtro-tipo-duracion">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos los tipos</SelectItem>
                                        <SelectItem value="preventivo">Preventivo</SelectItem>
                                        <SelectItem value="correctivo">Correctivo</SelectItem>
                                    </SelectContent>
                                </Select>

                                {/* Técnico */}
                                <Select value={filtroTecnico} onValueChange={setFiltroTecnico}>
                                    <SelectTrigger className="w-52 h-9 bg-panel border-borde" id="filtro-tecnico-duracion">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos los técnicos</SelectItem>
                                        {tecnicosUnicos.map(t => (
                                            <SelectItem key={t} value={t}>{t}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* Rango de fechas */}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-tinta-tenue shrink-0">Desde</span>
                                    <Input
                                        type="date"
                                        value={filtroDesde}
                                        onChange={(e) => setFiltroDesde(e.target.value)}
                                        className="h-9 w-36 bg-panel border-borde text-sm"
                                        id="filtro-desde-duracion"
                                    />
                                    <span className="text-xs text-tinta-tenue shrink-0">Hasta</span>
                                    <Input
                                        type="date"
                                        value={filtroHasta}
                                        onChange={(e) => setFiltroHasta(e.target.value)}
                                        className="h-9 w-36 bg-panel border-borde text-sm"
                                        id="filtro-hasta-duracion"
                                    />
                                </div>

                                {hayFiltrosDuracion && (
                                    <Button variant="ghost" size="sm" onClick={limpiarFiltrosDuracion}
                                        className="h-9 gap-1.5 text-xs text-tinta-tenue hover:text-tinta-media">
                                        <X className="h-3.5 w-3.5" /> Limpiar
                                    </Button>
                                )}

                                {/* Contador */}
                                <span className="text-xs text-tinta-tenue ml-auto">
                                    {duracionFiltrada.length} de {duracion.length} intervenciones
                                </span>
                            </div>

                            {/* Promedios por tipo — recalculados sobre datos FILTRADOS */}
                            {promediosFiltrados.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {promediosFiltrados.map(p => (
                                        <div key={p.tipo} className="rounded-xl border border-borde bg-panel p-4 flex items-start gap-3">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-marca-suave">
                                                <Clock className="h-4 w-4 text-marca-tinta" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-tinta-tenue">{p.tipo}</p>
                                                <p className="text-lg font-bold text-tinta">{p.avg} min</p>
                                                <p className="text-[10px] text-tinta-tenue">{p.count} intervención{p.count !== 1 ? 'es' : ''}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-xl border border-borde bg-panel-suave p-4 text-center text-sm text-tinta-tenue">
                                    Sin datos de duración para los filtros aplicados
                                </div>
                            )}

                            {/* Tabla de intervenciones */}
                            {duracionFiltrada.length === 0 ? (
                                <EmptyState mensaje="Ninguna intervención coincide con los filtros aplicados." />
                            ) : (
                                <div className="rounded-xl border border-borde bg-panel overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-borde bg-panel-suave">
                                                    {['Equipo', 'Tipo', 'Técnico', 'Fecha', 'Entrada', 'Salida', 'Duración'].map(h => (
                                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-tinta-media uppercase tracking-wide whitespace-nowrap">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {duracionFiltrada.map(row => (
                                                    <tr key={row.id_reporte} className="border-b border-borde-suave hover:bg-panel-suave transition-colors">
                                                        <td className="px-4 py-3">
                                                            <p className="font-mono text-xs font-bold text-marca-tinta">{row.codigo_mh}</p>
                                                            <p className="text-[11px] text-tinta-tenue">{row.marca} {row.modelo}</p>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <Badge className={`text-[11px] px-2 py-0.5 ${row.nombre_tipo.toLowerCase().includes('correctivo') ? 'bg-critico-suave text-critico-tinta border-critico-linea border' : 'bg-marca-suave text-marca-tinta border-marca-linea border'}`}>
                                                                {row.nombre_tipo}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-4 py-3 text-tinta-media whitespace-nowrap">{row.tecnico_responsable}</td>
                                                        <td className="px-4 py-3 text-tinta-media whitespace-nowrap">
                                                            {new Date(row.fecha_ejecucion).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })}
                                                        </td>
                                                        <td className="px-4 py-3 text-tinta-media font-mono text-xs">{row.hora_entrada ?? '—'}</td>
                                                        <td className="px-4 py-3 text-tinta-media font-mono text-xs">{row.hora_salida ?? '—'}</td>
                                                        <td className="px-4 py-3">
                                                            {row.duracion_minutos != null ? (
                                                                <span className="flex items-center gap-1 text-tinta-media font-semibold">
                                                                    <TrendingUp className="h-3.5 w-3.5 text-tinta-tenue" />
                                                                    {row.duracion_minutos} min
                                                                </span>
                                                            ) : '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
