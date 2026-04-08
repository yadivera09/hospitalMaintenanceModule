'use client'

import { useState, useMemo } from 'react'
import { Package, Search, Plus, Trash2, AlertCircle, Loader2 } from 'lucide-react'
import { crearInsumoRapido } from '@/app/actions/reportes'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { Insumo } from '@/types'

/**
 * InsumoSelector
 * Componente reutilizable para seleccionar insumos del catálogo o agregar nuevos manualmente.
 */

interface SelectedItem {
    uid: string
    insumo_id?: string
    nombre: string
    codigo: string | null
    unidad: string
    cantidad: number
    es_nuevo?: boolean
    motivo?: string | null
}

interface InsumoSelectorProps {
    tipo: 'usado' | 'requerido'
    items: SelectedItem[]
    catalogo: Insumo[]
    errors?: any
    readOnly?: boolean
    onAdd: (item: SelectedItem) => void
    onRemove: (uid: string) => void
    onChange: (uid: string, updates: Partial<SelectedItem>) => void
}

export default function InsumoSelector({
    tipo,
    items,
    catalogo,
    errors,
    readOnly,
    onAdd,
    onRemove,
    onChange
}: InsumoSelectorProps) {
    const [query, setQuery] = useState('')
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [isCreatingManual, setIsCreatingManual] = useState(false)
    const [extraInsumos, setExtraInsumos] = useState<Insumo[]>([])

    const suggestions = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return []
        const fullCatalogo = [...catalogo, ...extraInsumos]
        return fullCatalogo
            .filter(i => 
                i.nombre.toLowerCase().includes(q) || 
                (i.codigo && i.codigo.toLowerCase().includes(q))
            )
            .slice(0, 5)
    }, [query, catalogo, extraInsumos])

    const exactMatch = useMemo(() => {
        const q = query.trim().toLowerCase()
        const fullCatalogo = [...catalogo, ...extraInsumos]
        return fullCatalogo.find(i => i.nombre.toLowerCase() === q)
    }, [query, catalogo, extraInsumos])

    function handleSelectItem(insumo: Insumo) {
        onAdd({
            uid: crypto.randomUUID(),
            insumo_id: insumo.id,
            nombre: insumo.nombre,
            codigo: insumo.codigo,
            unidad: insumo.unidad_medida,
            cantidad: 1,
            es_nuevo: false,
            motivo: ''
        })
        setQuery('')
        setShowSuggestions(false)
    }

    async function handleAddManual() {
        if (!query.trim() || isCreatingManual) return
        
        setIsCreatingManual(true)
        try {
            const { data: newIns, error } = await crearInsumoRapido(query)
            if (error) {
                alert(error)
                return
            }
            if (newIns) {
                // Agregar al catálogo local para que sea buscable inmediatamente
                setExtraInsumos(prev => [...prev, newIns])
                
                onAdd({
                    uid: crypto.randomUUID(),
                    insumo_id: newIns.id,
                    nombre: newIns.nombre,
                    codigo: newIns.codigo,
                    unidad: newIns.unidad_medida,
                    cantidad: 1,
                    es_nuevo: true,
                    motivo: ''
                })
            }
        } catch (err) {
            console.error(err)
            alert('Error al crear el insumo')
        } finally {
            setIsCreatingManual(false)
            setQuery('')
            setShowSuggestions(false)
        }
    }

    return (
        <div className="space-y-3">
            <Label className="text-xs font-medium text-[#334155]">
                {tipo === 'usado' ? 'Insumos usados *' : 'Insumos requeridos'}
            </Label>

            {!readOnly && (
                <div className="relative">
                    <div className="relative">
                        <Input
                            placeholder={`Buscar ${tipo === 'usado' ? 'insumo usado' : 'insumo faltante'}...`}
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value)
                                setShowSuggestions(true)
                            }}
                            onFocus={() => setShowSuggestions(true)}
                            className={`bg-white border-[#E2E8F0] h-11 pr-10 ${errors ? 'border-red-500' : ''}`}
                        />
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                    </div>

                    {showSuggestions && query.trim().length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-xl border border-[#E2E8F0] bg-white shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1">
                            {suggestions.map((i) => (
                                <button
                                    key={i.id}
                                    type="button"
                                    onClick={() => handleSelectItem(i)}
                                    className="w-full text-left px-4 py-3 hover:bg-[#F8FAFC] border-b border-[#F1F5F9] last:border-0 transition-colors"
                                >
                                    <p className="text-sm font-semibold text-[#0F172A]">{i.nombre}</p>
                                    <p className="text-[10px] text-[#64748B] font-mono uppercase tracking-tighter mt-0.5">
                                        {i.codigo ?? 'S/C'} · {i.unidad_medida}
                                    </p>
                                </button>
                            ))}

                            {!exactMatch && (
                                <button
                                    type="button"
                                    onClick={handleAddManual}
                                    disabled={isCreatingManual}
                                    className="w-full text-left px-4 py-3 bg-blue-50/50 hover:bg-blue-50 text-[#1E40AF] transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    <div className="h-6 w-6 rounded-full bg-[#1E40AF]/10 flex items-center justify-center">
                                        {isCreatingManual ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold leading-none">
                                            {isCreatingManual ? 'Creando insumo...' : 'Agregar nuevo insumo'}
                                        </p>
                                        <p className="text-[10px] opacity-70 mt-0.5 font-medium">"{query.trim()}"</p>
                                    </div>
                                </button>
                            )}
                            
                            {suggestions.length === 0 && !exactMatch && (
                                <div className="px-4 py-4 text-center">
                                    <AlertCircle className="h-5 w-5 text-[#94A3B8] mx-auto mb-1 opacity-20" />
                                    <p className="text-xs text-[#94A3B8]">No se encontraron coincidencias</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {errors && <p className="text-[10px] text-red-500 font-medium px-1">{errors.message}</p>}

            <div className="space-y-2">
                {items.length === 0 ? (
                    <div className="py-8 text-center rounded-xl border border-dashed border-[#E2E8F0] bg-slate-50/50">
                        <Package className="h-6 w-6 text-[#CBD5E1] mx-auto mb-2" />
                        <p className="text-xs text-[#94A3B8]">No hay insumos {tipo === 'usado' ? 'utilizados' : 'requeridos'}</p>
                    </div>
                ) : (
                    items.map((item, idx) => (
                        <div key={item.uid} className="rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-sm hover:border-[#1E40AF]/20 transition-all">
                            <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs font-bold text-[#0F172A] truncate">
                                            {item.nombre}
                                        </p>
                                        {item.es_nuevo && (
                                            <Badge variant="outline" className="text-[9px] h-4 px-1 bg-amber-50 text-amber-600 border-amber-200">Nuevo</Badge>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-[#94A3B8] font-mono mt-0.5">
                                        {item.codigo} · {item.unidad}
                                    </p>
                                </div>
                                
                                <div className="flex flex-col items-end gap-1.5">
                                    <div className="flex items-center gap-1">
                                        <Label className="text-[10px] text-[#94A3B8] mr-1">Cant.</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            value={item.cantidad}
                                            disabled={readOnly}
                                            onChange={(e) => onChange(item.uid, { cantidad: Math.max(1, Number(e.target.value)) })}
                                            className="h-8 w-14 text-center text-xs font-bold border-[#E2E8F0] bg-[#F8FAFC]"
                                        />
                                    </div>
                                    {!readOnly && (
                                        <button 
                                            onClick={() => onRemove(item.uid)}
                                            className="h-6 w-6 flex items-center justify-center rounded-md text-[#94A3B8] hover:text-red-500 hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {tipo === 'requerido' && (
                                <div className="mt-2.5 pt-2.5 border-t border-[#F8FAFC]">
                                    <Input
                                        placeholder="Motivo / observación por qué se requiere..."
                                        value={item.motivo ?? ''}
                                        disabled={readOnly}
                                        onChange={(e) => onChange(item.uid, { motivo: e.target.value })}
                                        className="h-8 text-[11px] bg-[#F8FAFC] border-transparent focus:border-[#E2E8F0] focus:bg-white"
                                    />
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
