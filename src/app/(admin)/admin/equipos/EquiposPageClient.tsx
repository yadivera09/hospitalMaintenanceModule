'use client'

/**
 * src/app/(admin)/admin/equipos/EquiposPageClient.tsx
 * Shell Client para la página de Equipos.
 * BLOQUE 3 — Botón "Nuevo Equipo" activo con createEquipo.
 */

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Cpu, Search, AlertCircle, AlertTriangle, Plus, Upload, Download } from 'lucide-react'
import { exportToExcel } from '@/lib/exportToExcel'
import { Input } from '@/components/ui/input'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import EquiposTable from '@/components/admin/equipos/EquiposTable'
import EquipoForm from '@/components/admin/equipos/EquipoForm'
import ModalCargaMasivaEquipos from '@/components/admin/equipos/ModalCargaMasivaEquipos'
import { getEquipos, createEquipo } from '@/app/actions/equipos'
import type { EquipoConCliente } from '@/app/actions/equipos'
import type { Categoria } from '@/app/actions/catalogos'
import type { EquipoFormValues } from '@/components/admin/equipos/EquipoForm'

interface TipoMant { id: string; nombre: string }

interface ContratoRef {
    id: string
    numero_contrato: string
    cliente_id: string
    activo: boolean
    cliente_nombre?: string
}

interface Props {
    equiposIniciales: EquipoConCliente[]
    categoriasList: Categoria[]
    tiposMantenimiento: TipoMant[]
    contratos: ContratoRef[]
    errorInicial: string | null
}

export default function EquiposPageClient({ equiposIniciales, categoriasList, tiposMantenimiento, contratos, errorInicial }: Props) {
    const router = useRouter()
    const [, startTransition] = useTransition()
    const [busqueda, setBusqueda] = useState('')
    const [filtroCategoria, setFiltroCategoria] = useState('todos')
    const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'baja'>('todos')
    const [filtroCliente, setFiltroCliente] = useState('todos')
    const [lista, setLista] = useState(equiposIniciales)

    // ─── Nuevo Equipo modal ──────────────────────────────────────────────────
    const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false)
    const [creandoEquipo, setCreandoEquipo] = useState(false)
    const [errorCrear, setErrorCrear] = useState<string | null>(null)
    const [modalCargaMasivaAbierto, setModalCargaMasivaAbierto] = useState(false)

    // Reflejar cambios SSR
    if (busqueda === '' && filtroCategoria === 'todos' && lista !== equiposIniciales) {
        setLista(equiposIniciales)
    }

    // Clientes únicos extraídos de los equipos cargados (sin query extra)
    const clientesUnicos = useMemo(() => {
        const map = new Map<string, string>()
        equiposIniciales.forEach((e) => {
            const nombre = e.cliente_nombre
            if (nombre) map.set(nombre, nombre)
        })
        return Array.from(map.values()).sort()
    }, [equiposIniciales])

    // Filtrado local: estado + cliente sobre la lista ya filtrada por búsqueda/categoría
    const listaFiltrada = useMemo(() => {
        return lista.filter((e) => {
            const matchEstado =
                filtroEstado === 'todos' ||
                (filtroEstado === 'activo' ? e.activo : !e.activo)
            const matchCliente =
                filtroCliente === 'todos' ||
                e.cliente_nombre === filtroCliente
            return matchEstado && matchCliente
        })
    }, [lista, filtroEstado, filtroCliente])

    async function handleFilterChange(b: string, cat: string) {
        setBusqueda(b)
        setFiltroCategoria(cat)

        startTransition(async () => {
            const { data } = await getEquipos({
                search: b || undefined,
                categoria_id: cat
            })
            if (data) setLista(data)
        })
    }

    async function handleCrearEquipo(valores: EquipoFormValues) {
        setCreandoEquipo(true)
        setErrorCrear(null)
        const result = await createEquipo({
            ...valores,
            numero_serie: valores.numero_serie || undefined,
            activo_fijo: valores.activo_fijo || undefined,
        })
        setCreandoEquipo(false)

        if (result.error) {
            setErrorCrear(result.error)
            return
        }

        setModalNuevoAbierto(false)
        // Refrescar la lista con el equipo nuevo
        startTransition(async () => {
            router.refresh()
            const { data } = await getEquipos()
            if (data) setLista(data)
        })
    }

    function handleExportar() {
        exportToExcel(
            listaFiltrada.map((e) => ({
                'Código MH': e.codigo_mh,
                Nombre: e.nombre,
                Marca: e.marca ?? '',
                Modelo: e.modelo ?? '',
                'Nº Serie': e.numero_serie ?? '',
                'Activo fijo': e.activo_fijo ?? '',
                Categoría: e.categoria_nombre ?? '',
                'Cliente actual': e.cliente_nombre ?? '',
                Estado: e.activo ? 'Activo' : 'Inactivo',
            })),
            'equipos'
        )
    }

    // Detectar si hay duplicados en la lista actual
    const numDuplicados = useMemo(() => {
        return lista.filter((e) => e.duplicado).length
    }, [lista])

    return (
        <div className="space-y-6">
            {/* Encabezado */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E40AF]/10">
                        <Cpu className="h-5 w-5 text-[#1E40AF]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[#0F172A] leading-none">Equipos</h1>
                        <p className="text-sm text-[#94A3B8] mt-0.5">
                            {equiposIniciales.filter((e) => e.activo).length} activos · {equiposIniciales.length} en total
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setModalCargaMasivaAbierto(true)}
                        className="gap-2 border-[#1E40AF]/20 text-[#1E40AF] hover:bg-blue-50"
                    >
                        <Upload className="h-4 w-4" />
                        Carga masiva
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleExportar}
                        className="gap-2 border-[#1E40AF]/20 text-[#1E40AF] hover:bg-blue-50"
                        id="btn-exportar-equipos"
                    >
                        <Download className="h-4 w-4" />
                        Exportar Excel
                    </Button>
                    <Button
                        id="btn-nuevo-equipo"
                        onClick={() => { setErrorCrear(null); setModalNuevoAbierto(true) }}
                        className="gap-2 bg-[#1E40AF] hover:bg-[#1E3A8A] text-white"
                    >
                        <Plus className="h-4 w-4" />
                        Nuevo Equipo
                    </Button>
                </div>
            </div>

            {errorInicial && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />{errorInicial}
                </div>
            )}

            {/* Buscador + filtros */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8] pointer-events-none" />
                    <Input id="buscar-equipo" type="search"
                        placeholder="Busca por Código MH, N° Serie o Activo fijo"
                        value={busqueda} onChange={(e) => handleFilterChange(e.target.value, filtroCategoria)}
                        className="pl-9 bg-white border-[#E2E8F0]" />
                </div>

                <Select value={filtroCategoria} onValueChange={(v) => handleFilterChange(busqueda, v)}>
                    <SelectTrigger className="w-52 bg-white border-[#E2E8F0]" id="filtro-categoria">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todas las categorías</SelectItem>
                        {categoriasList.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as typeof filtroEstado)}>
                    <SelectTrigger className="w-44 bg-white border-[#E2E8F0]" id="filtro-estado-equipo">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos los estados</SelectItem>
                        <SelectItem value="activo">Activo</SelectItem>
                        <SelectItem value="baja">Baja</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={filtroCliente} onValueChange={setFiltroCliente}>
                    <SelectTrigger className="w-52 bg-white border-[#E2E8F0]" id="filtro-cliente-equipo">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos los clientes</SelectItem>
                        {clientesUnicos.map((nombre) => (
                            <SelectItem key={nombre} value={nombre}>{nombre}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {(busqueda || filtroCategoria !== 'todos' || filtroEstado !== 'todos' || filtroCliente !== 'todos') && (
                    <Button variant="ghost" size="sm" onClick={() => {
                        handleFilterChange('', 'todos')
                        setFiltroEstado('todos')
                        setFiltroCliente('todos')
                    }} className="text-xs text-[#94A3B8] hover:text-[#334155]">
                        Limpiar
                    </Button>
                )}
            </div>

            {/* Banner de series duplicadas */}
            {numDuplicados > 0 && busqueda.trim() !== '' && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                        Se detectaron <strong>{numDuplicados}</strong> equipos con número de serie duplicado que coinciden con su búsqueda.
                        Verifique los datos o notifique al administrador para corregir el inventario.
                    </span>
                </div>
            )}

            {/* Tabla */}
            <div className="rounded-xl bg-white border border-[#E2E8F0] shadow-sm overflow-hidden">
                <EquiposTable
                    equipos={listaFiltrada}
                    onVerDetalle={(id) => router.push(`/admin/equipos/${id}`)}
                    onEditar={(e) => startTransition(() => { router.push(`/admin/equipos/${e.id}`) })}
                />
                <div className="px-4 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC]">
                    <p className="text-xs text-[#94A3B8]">
                        Mostrando {listaFiltrada.length} equipos
                    </p>
                </div>
            </div>

            {/* ── Modal: Nuevo Equipo ─────────────────────────────── */}
            <Dialog open={modalNuevoAbierto} onOpenChange={(open) => { if (!open) setModalNuevoAbierto(false) }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-[#0F172A]">Nuevo Equipo</DialogTitle>
                        <DialogDescription className="text-[#94A3B8]">
                            Completa los datos del equipo. La asignación a contrato se puede hacer desde el detalle.
                        </DialogDescription>
                    </DialogHeader>

                    {errorCrear && (
                        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
                            {errorCrear}
                        </div>
                    )}

                    <EquipoForm
                        modo="crear"
                        categorias={categoriasList}
                        tiposMantenimiento={tiposMantenimiento}
                        onGuardar={handleCrearEquipo}
                        onCancelar={() => setModalNuevoAbierto(false)}
                        isLoading={creandoEquipo}
                    />
                </DialogContent>
            </Dialog>
            {/* ── Modal: Carga Masiva ─────────────────────────────── */}
            <Dialog open={modalCargaMasivaAbierto} onOpenChange={setModalCargaMasivaAbierto}>
                <ModalCargaMasivaEquipos
                    categorias={categoriasList}
                    tiposMantenimiento={tiposMantenimiento}
                    contratos={contratos}
                    onSuccess={() => {
                        setModalCargaMasivaAbierto(false)
                        startTransition(() => {
                            router.refresh()
                            getEquipos().then(res => { if (res.data) setLista(res.data) })
                        })
                    }}
                    onCancel={() => setModalCargaMasivaAbierto(false)}
                />
            </Dialog>
        </div>
    )
}
