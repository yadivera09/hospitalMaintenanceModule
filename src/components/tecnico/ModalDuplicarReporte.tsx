'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Copy, Search, X, Check, Loader2, AlertCircle
} from 'lucide-react'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getEquipos, type EquipoConCliente } from '@/app/actions/equipos'
import { duplicarReporteAction } from '@/app/actions/reportes'

interface ModalDuplicarReporteProps {
    reporteIdOriginal: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export default function ModalDuplicarReporte({
    reporteIdOriginal,
    open,
    onOpenChange
}: ModalDuplicarReporteProps) {
    const router = useRouter()
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(false)
    const [equipos, setEquipos] = useState<EquipoConCliente[]>([])
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [duplicating, setDuplicating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Cargar equipos al abrir o limpiar al cerrar
    useEffect(() => {
        if (!open) {
            setSearch('')
            setEquipos([])
            setSelectedId(null)
            setError(null)
            return
        }
        
        // Cargar equipos al abrir
        setLoading(true)
        getEquipos({ search: '', activo: true, soloConContrato: true })
            .then(res => {
                if (!res.error) setEquipos(res.data || [])
                else setError(res.error)
            })
            .finally(() => setLoading(false))
    }, [open])

    // Búsqueda automática con debounce
    useEffect(() => {
        if (!open) return
        if (search.length < 2 && search.length !== 0) {
            // Si no es vacío ni tiene al menos 2 chars, vaciamos resultados si queremos, 
            // o dejamos los anteriores. El requerimiento dice: si < 2 vaciar.
            if (search.length > 0) setEquipos([])
            return
        }

        const timeout = setTimeout(() => {
            handleSearch()
        }, 400) // debounce de 400ms

        return () => clearTimeout(timeout)
    }, [search])

    const handleSearch = async () => {
        if (search.length < 2 && search.length !== 0) return
        setLoading(true)
        setError(null)
        try {
            const res = await getEquipos({ search, activo: true, soloConContrato: true })
            if (res.error) setError(res.error)
            else setEquipos(res.data || [])
        } catch (err) {
            setError('Error al buscar equipos')
        } finally {
            setLoading(false)
        }
    }

    const handleConfirmar = async () => {
        if (!selectedId) return
        setDuplicating(true)
        setError(null)
        try {
            const res = await duplicarReporteAction(reporteIdOriginal, selectedId)
            if (res.error) {
                setError(res.error)
            } else {
                onOpenChange(false)
                router.push(`/tecnico/nuevo-reporte/${selectedId}?reporteId=${res.data?.nuevo_id}&paso=4`)
                // Llevamos al paso 4 (revisión) para que el técnico valide y firme
            }
        } catch (err) {
            setError('Error inesperado al duplicar')
        } finally {
            setDuplicating(false)
        }
    }

    const selectedEquipo = equipos.find(e => e.id === selectedId)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Copy className="h-5 w-5 text-[#1E40AF]" />
                        Duplicar Reporte
                    </DialogTitle>
                    <DialogDescription>
                        Selecciona el nuevo equipo al que se le aplicarán los mismos datos de este reporte.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#94A3B8]" />
                            <Input
                                placeholder="Buscar por Código MH o Serie..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 h-10"
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                        <Button onClick={handleSearch} disabled={loading} variant="secondary" className="h-10 shrink-0">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
                        </Button>
                    </div>

                    <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {equipos.length > 0 ? (
                            equipos.map((e) => (
                                <button
                                    key={e.id}
                                    onClick={() => setSelectedId(e.id)}
                                    className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
                                        selectedId === e.id
                                            ? 'border-[#1E40AF] bg-blue-50/50 ring-1 ring-[#1E40AF]'
                                            : 'border-[#E2E8F0] hover:border-[#1E40AF]/30'
                                    }`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-mono font-bold text-[#1E40AF]">{e.codigo_mh}</p>
                                        <p className="text-sm font-semibold text-[#0F172A] truncate">{e.nombre}</p>
                                        <p className="text-[11px] text-[#64748B] truncate">
                                            {e.marca} · {e.modelo} · {e.cliente_nombre || 'Sin cliente'}
                                        </p>
                                    </div>
                                    {selectedId === e.id && (
                                        <div className="h-5 w-5 rounded-full bg-[#1E40AF] flex items-center justify-center shrink-0 ml-2">
                                            <Check className="h-3 w-3 text-white" />
                                        </div>
                                    )}
                                </button>
                            ))
                        ) : search.length >= 2 && !loading ? (
                            <div className="py-8 text-center text-[#94A3B8] text-sm italic">
                                No se encontraron equipos con ese criterio.
                            </div>
                        ) : null}
                    </div>

                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-600 flex items-start gap-2">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={duplicating}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirmar}
                        disabled={!selectedId || duplicating}
                        className="bg-[#1E40AF] hover:bg-[#1E3A8A] gap-2 min-w-[120px]"
                    >
                        {duplicating ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Procesando...</>
                        ) : (
                            <><Copy className="h-4 w-4" /> Duplicar ahora</>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
