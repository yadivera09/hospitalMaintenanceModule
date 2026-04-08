'use client'
/**
 * nuevo-reporte/page.tsx — Búsqueda de equipo con BLOQUEO POR BORRADOR.
 * Ahora utiliza `getEquipos` de Supabase en lugar de MOCK_EQUIPOS.
 * Cuando se selecciona un equipo, consulta a DB si hay un borrador activo.
 */
import { useState, useMemo, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, AlertTriangle, ChevronRight, Tag, Building2, Calendar, Play, FileEdit, Trash2, CheckCircle2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getEquipos, type EquipoConCliente } from '@/app/actions/equipos'
import { getBorradorReporte, eliminarBorradorReporte, getUltimoMantenimientoPreventivo } from '@/app/actions/reportes'

interface DraftExistente { id: string; fecha_inicio: string }

function formatFechaCorta(iso: string) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function formatFecha(iso: string) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function BuscarEquipoPage() {
    const router = useRouter()
    const [query, setQuery] = useState('')

    // Estado de equipos reales
    const [equipos, setEquipos] = useState<EquipoConCliente[]>([])
    const [cargandoEquipos, setCargandoEquipos] = useState(true)

    // Estado de selección y borrador
    const [seleccionado, setSeleccionado] = useState<EquipoConCliente | null>(null)
    const [borradorExistente, setBorradorExistente] = useState<DraftExistente | null>(null)
    const [cargandoBorrador, setCargandoBorrador] = useState(false)
    const [errorBorrador, setErrorBorrador] = useState<string | null>(null)

    const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
    const [isPending, startTransition] = useTransition()

    // Cargar equipos al montar
    useEffect(() => {
        async function fetchEquipos() {
            try {
                // Solo traemos equipos activos y con contrato vigente
                const res = await getEquipos({ activo: true, soloConContrato: true })
                if (res.data) setEquipos(res.data)
            } catch (err) {
                console.error(err)
            } finally {
                setCargandoEquipos(false)
            }
        }
        fetchEquipos()
    }, [])

    const resultados = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return []
        return equipos.filter(e =>
            e.codigo_mh.toLowerCase().includes(q) ||
            (e.numero_serie?.toLowerCase().includes(q) ?? false) ||
            (e.activo_fijo?.toLowerCase().includes(q) ?? false)
        )
    }, [query, equipos])

    const hayDuplicado = useMemo(() => {
        // En los equipos reales, validamos si la serie está duplicada en los resultados mostrados
        const series = resultados.map(e => e.numero_serie).filter(Boolean)
        return series.length !== new Set(series).size
    }, [resultados])

    async function handleSeleccionar(e: EquipoConCliente) {
        setSeleccionado(e)
        setConfirmandoEliminar(false)
        setBorradorExistente(null)
        setErrorBorrador(null)
        setCargandoBorrador(true)

        // Consultar a Supabase si existe un borrador para este equipo 
        // y el técnico actualmente logueado
        try {
            const [resBorrador, resUltimo] = await Promise.all([
                getBorradorReporte(e.id),
                getUltimoMantenimientoPreventivo(e.id)
            ])

            if (resBorrador.error) {
                setErrorBorrador(resBorrador.error)
            } else if (resBorrador.data) {
                setBorradorExistente({ id: resBorrador.data.id, fecha_inicio: resBorrador.data.fecha_inicio })
            }

            setSeleccionado(prev => prev ? { ...prev, fecha_ultimo_mantenimiento: resUltimo.data ?? null } : null)
        } catch (err) {
            setErrorBorrador('Error de red al consultar datos')
        } finally {
            setCargandoBorrador(false)
        }
    }

    function handleEliminarBorrador() {
        if (!borradorExistente) return
        startTransition(async () => {
            const res = await eliminarBorradorReporte(borradorExistente.id)
            if (res.error) {
                setErrorBorrador(res.error)
                setConfirmandoEliminar(false)
                return
            }
            // Éxito: borrar estado local
            setBorradorExistente(null)
            setConfirmandoEliminar(false)
        })
    }

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-lg font-bold text-[#0F172A]">Nuevo reporte</h1>
                <p className="text-xs text-[#94A3B8]">Busca el equipo a intervenir</p>
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#94A3B8] pointer-events-none" />
                <Input id="buscar-equipo-tecnico" type="search"
                    placeholder="Busca por Código MH, N° Serie o Activo fijo"
                    value={query}
                    onChange={e => { setQuery(e.target.value); setSeleccionado(null); setBorradorExistente(null) }}
                    className="pl-12 h-12 text-base bg-white border-[#E2E8F0] rounded-xl shadow-sm" autoFocus />
            </div>

            {hayDuplicado && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 font-medium">
                        Se encontraron equipos con el mismo número de serie. Verifica antes de continuar.
                    </p>
                </div>
            )}

            {cargandoEquipos ? (
                <div className="text-center py-8 text-sm text-[#94A3B8]">Cargando equipos...</div>
            ) : query.trim() && resultados.length === 0 ? (
                <div className="text-center py-8 text-sm text-[#94A3B8]">Sin resultados para &ldquo;{query}&rdquo;</div>
            ) : null}

            {resultados.length > 0 && !seleccionado && (
                <div className="space-y-2" id="resultados-busqueda">
                    {resultados.map(e => {
                        return (
                            <button key={e.id} onClick={() => handleSeleccionar(e)}
                                className="w-full text-left rounded-xl border border-[#E2E8F0] bg-white shadow-sm px-4 py-3 hover:border-[#1E40AF]/40 hover:shadow-md transition-all">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-mono font-bold text-[#1E40AF]">{e.codigo_mh}</span>
                                            <Badge className={`text-[10px] px-1.5 py-0 ${e.activo ? 'bg-green-50 text-green-700 border-green-200 border' : 'bg-[#F1F5F9] text-[#94A3B8] border-[#E2E8F0] border'}`}>
                                                {e.activo ? 'activo' : 'inactivo'}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-[#334155] truncate mt-0.5">{e.nombre}</p>
                                        <p className="text-xs text-[#94A3B8]">{e.marca || 'S/M'} · {e.modelo || 'S/M'} · S/N: {e.numero_serie || '—'}</p>
                                        <p className="text-xs text-[#334155] font-medium">{e.cliente_nombre ? `📦 ${e.cliente_nombre}` : 'Sin asignación'}</p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-[#94A3B8] shrink-0" />
                                </div>
                            </button>
                        )
                    })}
                </div>
            )}

            {seleccionado && (
                <div className="space-y-3" id="card-confirmacion-equipo">

                    {errorBorrador && (
                        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3">
                            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-red-800 font-medium">
                                Error con borrador: {errorBorrador}
                            </p>
                        </div>
                    )}

                    {/* ── BLOQUEO POR BORRADOR ── */}
                    {cargandoBorrador ? (
                        <div className="flex justify-center p-4">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1E40AF] border-t-transparent" />
                        </div>
                    ) : borradorExistente ? (
                        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 space-y-3" id="bloqueo-borrador-activo">
                            <div className="flex items-start gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
                                    <FileEdit className="h-4 w-4 text-amber-700" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-amber-900">
                                        {seleccionado.codigo_mh} tiene un reporte en progreso
                                    </p>
                                    <p className="text-xs text-amber-700 mt-1">
                                        Iniciado el {formatFechaCorta(borradorExistente.fecha_inicio)}.
                                        Debes completarlo o eliminarlo antes de crear uno nuevo.
                                    </p>
                                </div>
                            </div>

                            {confirmandoEliminar ? (
                                <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
                                    <p className="text-xs text-red-800 font-medium">¿Seguro? Esta acción no se puede deshacer.</p>
                                    <div className="flex gap-2">
                                        <Button onClick={handleEliminarBorrador} disabled={isPending}
                                            className="flex-1 h-9 bg-red-600 hover:bg-red-700 text-white text-xs gap-1.5">
                                            {isPending ? <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" /> : <Trash2 className="h-3.5 w-3.5" />}
                                            Sí, eliminar
                                        </Button>
                                        <Button onClick={() => setConfirmandoEliminar(false)} disabled={isPending} variant="outline" className="flex-1 h-9 text-xs">
                                            Cancelar
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    {/* Pasamos a [equipoId] con param draft=true si usamos el mismo path o pasamos el ID del reporte */}
                                    {/* Nota: si el reporte ya existe, el wizard debe cargar los datos del reporteId */}
                                    <Button onClick={() => router.push(`/tecnico/nuevo-reporte/${seleccionado.id}?reporteId=${borradorExistente.id}`)}
                                        className="flex-1 h-10 bg-[#1E40AF] hover:bg-[#1E3A8A] text-white text-xs gap-1.5"
                                        id="btn-continuar-borrador">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> Continuar reporte
                                    </Button>
                                    <Button onClick={() => setConfirmandoEliminar(true)} variant="outline"
                                        className="flex-1 h-10 text-xs border-red-200 text-red-600 hover:bg-red-50 gap-1.5"
                                        id="btn-eliminar-borrador">
                                        <Trash2 className="h-3.5 w-3.5" /> Eliminar reporte
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* ── CARD NORMAL sin borrador ── */
                        <div className="rounded-xl border-2 border-[#1E40AF]/30 bg-white shadow-md p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-lg font-mono font-bold text-[#1E40AF]">{seleccionado.codigo_mh}</span>
                                <button onClick={() => setSeleccionado(null)} className="text-xs text-[#94A3B8] underline">Cambiar</button>
                            </div>
                            <div>
                                <p className="text-base font-bold text-[#0F172A]">{seleccionado.nombre}</p>
                                <p className="text-sm text-[#94A3B8]">{seleccionado.marca || 'S/M'} · {seleccionado.modelo || 'S/M'}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="flex items-start gap-1.5">
                                    <Tag className="h-3 w-3 text-[#94A3B8] mt-0.5 shrink-0" />
                                    <div><p className="text-[#94A3B8]">Categoría</p><p className="font-medium text-[#334155]">{seleccionado.categoria_nombre ?? '—'}</p></div>
                                </div>
                                <div className="flex items-start gap-1.5">
                                    <Building2 className="h-3 w-3 text-[#94A3B8] mt-0.5 shrink-0" />
                                    <div><p className="text-[#94A3B8]">Cliente</p><p className="font-medium text-[#334155]">{seleccionado.cliente_nombre ?? 'Sin asignación'}</p></div>
                                </div>
                                {seleccionado.numero_contrato && (
                                    <div className="flex items-start gap-1.5">
                                        <Building2 className="h-3 w-3 text-[#94A3B8] mt-0.5 shrink-0" />
                                        <div><p className="text-[#94A3B8]">Contrato</p><p className="font-medium text-[#1E40AF]">{seleccionado.numero_contrato}</p></div>
                                    </div>
                                )}
                                <div className="flex items-start gap-1.5">
                                    <Calendar className="h-3 w-3 text-[#94A3B8] mt-0.5 shrink-0" />
                                    <div><p className="text-[#94A3B8]">Último preventivo</p><p className="font-medium text-[#334155]">{formatFecha(seleccionado.fecha_ultimo_mantenimiento as string)}</p></div>
                                </div>
                            </div>
                            <Button onClick={() => router.push(`/tecnico/nuevo-reporte/${seleccionado.id}`)}
                                className="w-full bg-[#1E40AF] hover:bg-[#1E3A8A] text-white gap-2 h-12 text-sm font-semibold"
                                id="btn-iniciar-reporte">
                                <Play className="h-4 w-4" /> Iniciar reporte con este equipo
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {!query.trim() && !seleccionado && !cargandoEquipos && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E2E8F0] mb-3">
                        <Search className="h-7 w-7 text-[#94A3B8]" />
                    </div>
                    <p className="text-sm text-[#94A3B8]">Escribe el código o serie del equipo</p>
                </div>
            )}
        </div>
    )
}
