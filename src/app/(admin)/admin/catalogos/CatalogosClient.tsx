'use client'

/**
 * src/app/(admin)/admin/catalogos/CatalogosClient.tsx
 * Shell Client del módulo Catálogos — 4 tabs.
 * BLOQUE 2 — Recibe datos iniciales del Server Component y usa server actions para mutaciones.
 */

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
    BookOpen, Plus, Pencil,
    GripVertical, CheckSquare, Package,
    MapPin, Tag, Download, ChevronDown,
    AlertTriangle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    Table, TableBody, TableCell,
    TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { exportToExcel } from '@/lib/exportToExcel'
import {
    createCategoria, updateCategoria, toggleActivaCategoria,
    createInsumo, updateInsumo, toggleActivoInsumo, getInsumos,
    createUbicacion, updateUbicacion, toggleActivaUbicacion,
    createActividad, toggleActivaActividad,
    type Categoria, type Insumo, type ActividadChecklist,
    type UbicacionConCliente
} from '@/app/actions/catalogos'
import type { Cliente } from '@/types'

// ─── Tipos de props ───────────────────────────────────────────────────────────

interface TipoMant { id: string; nombre: string; periodicidad_dias: number; activo: boolean }

interface Props {
    categoriasIniciales: Categoria[]
    insumosIniciales: Insumo[]
    ubicacionesIniciales: UbicacionConCliente[]
    clientesList: Cliente[]
    tiposIniciales: TipoMant[]
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────



function SectionHeader({ icon: Icon, title, count, onNuevo }: {
    icon: React.ComponentType<{ className?: string }>
    title: string; count: number; onNuevo: () => void
}) {
    return (
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-[#94A3B8]" />
                <h2 className="text-sm font-semibold text-[#0F172A]">{title}</h2>
                <span className="text-xs text-[#94A3B8] bg-[#F1F5F9] rounded-full px-2 py-0.5">{count}</span>
            </div>
            <Button onClick={onNuevo} size="sm" className="bg-[#1E40AF] hover:bg-[#1E3A8A] text-white gap-1.5 h-8 text-xs">
                <Plus className="h-3.5 w-3.5" /> Agregar
            </Button>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1 — CATEGORÍAS
// ─────────────────────────────────────────────────────────────────────────────

function TabCategorias({ inicial, onRefresh }: { inicial: Categoria[]; onRefresh: () => void }) {
    const [modal, setModal] = useState(false)
    const [editando, setEditando] = useState<Categoria | undefined>()
    const [form, setForm] = useState({ nombre: '', descripcion: '' })
    const [error, setError] = useState<string | null>(null)

    async function guardar() {
        setError(null)
        const result = editando
            ? await updateCategoria(editando.id, { nombre: form.nombre, descripcion: form.descripcion || null })
            : await createCategoria({ nombre: form.nombre, descripcion: form.descripcion || null })
        if (result.error) { setError(result.error); return }
        setModal(false); onRefresh()
    }

    async function handleToggle(c: Categoria) {
        await toggleActivaCategoria(c.id)
        onRefresh()
    }

    return (
        <div>
            <SectionHeader icon={Tag} title="Categorías de equipo" count={inicial.length} onNuevo={() => {
                setEditando(undefined); setForm({ nombre: '', descripcion: '' }); setError(null); setModal(true)
            }} />
            <div className="rounded-lg border border-[#E2E8F0] overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-[#F8FAFC]">
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase py-3 pl-4">Nombre</TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase py-3">Activa</TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase py-3 text-right pr-4">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {inicial.map((c) => (
                            <TableRow key={c.id} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC]">
                                <TableCell className="py-3 pl-4">
                                    <p className="text-sm font-medium text-[#0F172A]">{c.nombre}</p>
                                    {c.descripcion && <p className="text-xs text-[#94A3B8] mt-0.5">{c.descripcion}</p>}
                                </TableCell>
                                <TableCell className="py-3">
                                    <Switch checked={c.activa} onCheckedChange={() => handleToggle(c)} />
                                </TableCell>
                                <TableCell className="py-3 pr-4 text-right">
                                    <Button variant="ghost" size="sm" onClick={() => {
                                        setEditando(c); setForm({ nombre: c.nombre, descripcion: c.descripcion ?? '' }); setError(null); setModal(true)
                                    }} className="h-7 w-7 p-0 text-[#94A3B8] hover:text-[#D97706] hover:bg-amber-50">
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {inicial.length === 0 && (
                            <TableRow><TableCell colSpan={3} className="py-8 text-center text-sm text-[#94A3B8]">Sin categorías registradas</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <Dialog open={modal} onOpenChange={(o) => !o && setModal(false)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{editando ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
                        <DialogDescription className="text-[#94A3B8]">Categoría de equipo hospitalario</DialogDescription>
                    </DialogHeader>
                    {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-[#334155]">Nombre *</Label>
                            <Input value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Cama hospitalaria" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-[#334155]">Descripción</Label>
                            <Input value={form.descripcion} onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))} placeholder="Descripción opcional" />
                        </div>
                        <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
                            <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
                            <Button onClick={guardar} disabled={!form.nombre.trim()} className="bg-[#1E40AF] hover:bg-[#1E3A8A] text-white">
                                {editando ? 'Actualizar' : 'Guardar'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2 — INSUMOS
// ─────────────────────────────────────────────────────────────────────────────

function TabInsumos({ inicial, onRefresh }: { inicial: Insumo[]; onRefresh: () => void }) {
    const [modal, setModal] = useState(false)
    const [editando, setEditando] = useState<Insumo | undefined>()
    const [form, setForm] = useState({ nombre: '', codigo: '', unidad_medida: 'Unidad' })
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'inactivo'>('todos')
    const [lista, setLista] = useState(inicial)

    // Reflejar cambios del SSR si refrescamos globalmente y search está vacío
    if (search === '' && lista !== inicial) {
        setLista(inicial)
    }

    async function handleSearch(term: string) {
        setSearch(term)
        if (!term) {
            setLista(inicial)
            return
        }
        const { data } = await getInsumos({ search: term })
        if (data) setLista(data)
    }

    // Filtrado local por estado (sobre lista ya filtrada por búsqueda del servidor)
    const listaFiltrada = useMemo(() => {
        if (filtroEstado === 'todos') return lista
        return lista.filter((i) =>
            filtroEstado === 'activo' ? i.activo : !i.activo
        )
    }, [lista, filtroEstado])

    // Detectar nombres duplicados (case-insensitive) sobre TODA la lista cargada
    const nombresConDuplicado = useMemo(() => {
        const conteo = new Map<string, number>()
        lista.forEach((i: Insumo) => {
            const key = i.nombre.trim().toLowerCase()
            conteo.set(key, (conteo.get(key) ?? 0) + 1)
        })
        const duplicados = new Set<string>()
        conteo.forEach((count: number, key: string) => { if (count > 1) duplicados.add(key) })
        return duplicados
    }, [lista])

    async function guardar() {
        setError(null)
        const payload = { nombre: form.nombre, codigo: form.codigo || null, unidad_medida: form.unidad_medida }
        const result = editando
            ? await updateInsumo(editando.id, payload)
            : await createInsumo(payload)
        if (result.error) { setError(result.error); return }
        setModal(false)
        if (search) handleSearch(search)
        else onRefresh()
    }

    async function handleToggle(i: Insumo) {
        await toggleActivoInsumo(i.id)
        if (search) handleSearch(search)
        else onRefresh()
    }

    return (
        <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
                <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-[#94A3B8]" />
                    <h2 className="text-sm font-semibold text-[#0F172A]">Insumos</h2>
                    <span className="text-xs text-[#94A3B8] bg-[#F1F5F9] rounded-full px-2 py-0.5">{listaFiltrada.length}</span>
                    {nombresConDuplicado.size > 0 && (
                        <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                            <AlertTriangle className="h-3 w-3" />
                            {nombresConDuplicado.size} nombre{nombresConDuplicado.size > 1 ? 's' : ''} duplicado{nombresConDuplicado.size > 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Input
                        placeholder="Buscar por código o nombre..."
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full sm:w-56 max-w-sm h-8 mt-0 bg-white"
                    />

                    <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as typeof filtroEstado)}>
                        <SelectTrigger className="w-36 h-8 bg-white border-[#E2E8F0]" id="filtro-estado-insumo">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos</SelectItem>
                            <SelectItem value="activo">Activo</SelectItem>
                            <SelectItem value="inactivo">Inactivo</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button onClick={() => {
                        setEditando(undefined); setForm({ nombre: '', codigo: '', unidad_medida: 'Unidad' }); setError(null); setModal(true)
                    }} size="sm" className="bg-[#1E40AF] hover:bg-[#1E3A8A] text-white gap-1.5 h-8 text-xs shrink-0">
                        <Plus className="h-3.5 w-3.5" /> Agregar
                    </Button>
                </div>
            </div>
            <div className="rounded-lg border border-[#E2E8F0] overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-[#F8FAFC]">
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase py-3 pl-4">Nombre</TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase py-3 hidden sm:table-cell">Código</TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase py-3 hidden md:table-cell">Unidad</TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase py-3">Estado</TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase py-3 text-right pr-4">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {listaFiltrada.map((i: Insumo) => {
                            const esDuplicado = nombresConDuplicado.has(i.nombre.trim().toLowerCase())
                            return (
                            <TableRow key={i.id} className={`border-b border-[#E2E8F0] hover:bg-[#F8FAFC] ${esDuplicado ? 'bg-amber-50/40' : ''}`}>
                                <TableCell className="py-3 pl-4">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-sm font-medium text-[#0F172A]">{i.nombre}</p>
                                        {esDuplicado && (
                                            <TooltipProvider delayDuration={200}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="cursor-help">
                                                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="right" className="text-xs">
                                                        Nombre duplicado — elimina el registro extra
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="py-3 hidden sm:table-cell"><span className="text-xs font-mono text-[#334155]">{i.codigo ?? '—'}</span></TableCell>
                                <TableCell className="py-3 hidden md:table-cell"><span className="text-sm text-[#334155]">{i.unidad_medida}</span></TableCell>
                                <TableCell className="py-3">
                                    <Switch checked={i.activo} onCheckedChange={() => handleToggle(i)} />
                                </TableCell>
                                <TableCell className="py-3 pr-4 text-right">
                                    <Button variant="ghost" size="sm" onClick={() => {
                                        setEditando(i); setForm({ nombre: i.nombre, codigo: i.codigo ?? '', unidad_medida: i.unidad_medida }); setError(null); setModal(true)
                                    }} className="h-7 w-7 p-0 text-[#94A3B8] hover:text-[#D97706] hover:bg-amber-50">
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                            )
                        })}
                        {listaFiltrada.length === 0 && (
                            <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-[#94A3B8]">No hay insumos{filtroEstado !== 'todos' ? ` con estado ${filtroEstado}` : ''}</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <Dialog open={modal} onOpenChange={(o) => !o && setModal(false)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{editando ? 'Editar insumo' : 'Nuevo insumo'}</DialogTitle>
                        <DialogDescription className="text-[#94A3B8]">Material o repuesto usado en mantenimientos</DialogDescription>
                    </DialogHeader>
                    {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-[#334155]">Nombre *</Label>
                            <Input value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} placeholder="Nombre del insumo" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-[#334155]">Código interno</Label>
                                <Input value={form.codigo} onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value }))} placeholder="LUB-001" className="font-mono" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-[#334155]">Unidad</Label>
                                <Input value={form.unidad_medida} onChange={(e) => setForm((p) => ({ ...p, unidad_medida: e.target.value }))} placeholder="Unidad" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
                            <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
                            <Button onClick={guardar} disabled={!form.nombre.trim()} className="bg-[#1E40AF] hover:bg-[#1E3A8A] text-white">
                                {editando ? 'Actualizar' : 'Guardar'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3 — UBICACIONES
// ─────────────────────────────────────────────────────────────────────────────

function TabUbicaciones({ inicial, clientesList, onRefresh }: { inicial: UbicacionConCliente[]; clientesList: Cliente[]; onRefresh: () => void }) {
    const [modal, setModal] = useState(false)
    const [editando, setEditando] = useState<UbicacionConCliente | undefined>()
    const [form, setForm] = useState({ nombre: '', cliente_id: '', descripcion: '' })
    const [error, setError] = useState<string | null>(null)
    const [filtroCliente, setFiltroCliente] = useState<string>('todos')

    const clienteMap = Object.fromEntries(clientesList.map((c) => [c.id, c.razon_social]))
    const listaFiltrada = filtroCliente === 'todos' ? inicial : inicial.filter((u) => u.cliente_id === filtroCliente)

    async function guardar() {
        setError(null)
        const payload = { nombre: form.nombre, cliente_id: form.cliente_id, descripcion: form.descripcion || null }
        const result = editando
            ? await updateUbicacion(editando.id, payload)
            : await createUbicacion(payload)
        if (result.error) { setError(result.error); return }
        setModal(false); onRefresh()
    }

    async function handleToggle(u: UbicacionConCliente) {
        await toggleActivaUbicacion(u.id)
        onRefresh()
    }

    return (
        <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
                <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#94A3B8]" />
                    <h2 className="text-sm font-semibold text-[#0F172A]">Ubicaciones</h2>
                    <span className="text-xs text-[#94A3B8] bg-[#F1F5F9] rounded-full px-2 py-0.5">{listaFiltrada.length}</span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Select value={filtroCliente} onValueChange={setFiltroCliente}>
                        <SelectTrigger className="w-[180px] h-8 bg-white"><SelectValue placeholder="Todos los clientes" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos los clientes</SelectItem>
                            {clientesList.filter(c => c.activo).map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.razon_social}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={() => {
                        setEditando(undefined); setForm({ nombre: '', cliente_id: '', descripcion: '' }); setError(null); setModal(true)
                    }} size="sm" className="bg-[#1E40AF] hover:bg-[#1E3A8A] text-white gap-1.5 h-8 text-xs shrink-0">
                        <Plus className="h-3.5 w-3.5" /> Agregar
                    </Button>
                </div>
            </div>
            <div className="rounded-lg border border-[#E2E8F0] overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-[#F8FAFC]">
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase py-3 pl-4">Nombre</TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase py-3 hidden md:table-cell">Cliente</TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase py-3">Activa</TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase py-3 text-right pr-4">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {listaFiltrada.map((u) => (
                            <TableRow key={u.id} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC]">
                                <TableCell className="py-3 pl-4">
                                    <p className="text-sm font-medium text-[#0F172A]">{u.nombre}</p>
                                    {u.descripcion && <p className="text-xs text-[#94A3B8] mt-0.5">{u.descripcion}</p>}
                                </TableCell>
                                <TableCell className="py-3 hidden md:table-cell">
                                    <span className="text-sm text-[#334155]">{clienteMap[u.cliente_id] ?? '—'}</span>
                                </TableCell>
                                <TableCell className="py-3">
                                    <Switch checked={u.activa} onCheckedChange={() => handleToggle(u)} />
                                </TableCell>
                                <TableCell className="py-3 pr-4 text-right">
                                    <Button variant="ghost" size="sm" onClick={() => {
                                        setEditando(u); setForm({ nombre: u.nombre, cliente_id: u.cliente_id, descripcion: u.descripcion ?? '' }); setError(null); setModal(true)
                                    }} className="h-7 w-7 p-0 text-[#94A3B8] hover:text-[#D97706] hover:bg-amber-50">
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {listaFiltrada.length === 0 && (
                            <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-[#94A3B8]">Sin ubicaciones registradas o no hay para este filtro</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <Dialog open={modal} onOpenChange={(o) => !o && setModal(false)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{editando ? 'Editar ubicación' : 'Nueva ubicación'}</DialogTitle>
                        <DialogDescription className="text-[#94A3B8]">Piso, sala o área dentro de un cliente</DialogDescription>
                    </DialogHeader>
                    {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-[#334155]">Nombre *</Label>
                            <Input value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} placeholder="Ej: UCI Piso 3" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-[#334155]">Cliente *</Label>
                            <Select value={form.cliente_id} onValueChange={(v) => setForm((p) => ({ ...p, cliente_id: v }))}>
                                <SelectTrigger><SelectValue placeholder="Selecciona un cliente…" /></SelectTrigger>
                                <SelectContent>
                                    {clientesList.map((c) => (<SelectItem key={c.id} value={c.id}>{c.razon_social}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-[#334155]">Descripción</Label>
                            <Input value={form.descripcion} onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))} placeholder="Descripción opcional" />
                        </div>
                        <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
                            <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
                            <Button onClick={guardar} disabled={!form.nombre.trim() || !form.cliente_id} className="bg-[#1E40AF] hover:bg-[#1E3A8A] text-white">
                                {editando ? 'Actualizar' : 'Guardar'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 4 — CHECKLIST
// ─────────────────────────────────────────────────────────────────────────────

function TabChecklist({ categorias }: { categorias: Categoria[] }) {
    const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? '')
    const [actividades, setActividades] = useState<ActividadChecklist[]>([])
    const [nuevaDesc, setNuevaDesc] = useState('')
    const [cargando, setCargando] = useState(false)

    // Cargar actividades al cambiar de categoría
    async function cargarActividades(catId: string) {
        setCargando(true)
        const { getActividadesByCategoria } = await import('@/app/actions/catalogos')
        const { data } = await getActividadesByCategoria(catId)
        setActividades(data ?? [])
        setCargando(false)
    }

    const actuales = actividades
        .filter((a) => a.categoria_id === categoriaId)
        .sort((a, b) => a.orden - b.orden)

    async function agregarActividad() {
        const desc = nuevaDesc.trim()
        if (!desc || !categoriaId) return
        const maxOrden = actuales.length > 0 ? Math.max(...actuales.map((a) => a.orden)) : 0
        const result = await createActividad({ categoria_id: categoriaId, descripcion: desc, orden: maxOrden + 1 })
        if (result.data) {
            setActividades((p) => [...p, result.data!])
            setNuevaDesc('')
        }
    }

    async function handleToggleActiva(a: ActividadChecklist) {
        const result = await toggleActivaActividad(a.id)
        if (result.data) setActividades((p) => p.map((x) => x.id === a.id ? { ...x, activa: !x.activa } : x))
    }

    return (
        <div>
            <div className="flex items-center gap-3 mb-5">
                <CheckSquare className="h-4 w-4 text-[#94A3B8]" />
                <h2 className="text-sm font-semibold text-[#0F172A]">Checklist por categoría</h2>
                <div className="ml-auto w-56">
                    <Select value={categoriaId} onValueChange={(v) => { setCategoriaId(v); cargarActividades(v) }}>
                        <SelectTrigger className="h-8 text-sm bg-white border-[#E2E8F0]" id="selector-categoria-checklist"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {cargando ? (
                <div className="py-8 text-center text-sm text-[#94A3B8]">Cargando actividades…</div>
            ) : actuales.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center rounded-lg border border-dashed border-[#E2E8F0]">
                    <CheckSquare className="h-8 w-8 text-[#E2E8F0] mb-2" />
                    <p className="text-sm text-[#94A3B8]">Sin actividades. Agrega la primera abajo.</p>
                </div>
            ) : (
                <div className="space-y-1.5">
                    {actuales.map((a, idx) => (
                        <div key={a.id} className={`flex items-center gap-3 rounded-lg border px-3.5 py-3 transition-colors ${a.activa ? 'border-[#E2E8F0] bg-white' : 'border-[#E2E8F0] bg-[#F8FAFC] opacity-60'}`}>
                            <GripVertical className="h-4 w-4 text-[#CBD5E1] cursor-grab shrink-0" aria-label="Reordenar (Bloque 3)" />
                            <span className="text-xs font-mono text-[#94A3B8] w-5 shrink-0">{idx + 1}.</span>
                            <p className={`text-sm flex-1 ${a.activa ? 'text-[#334155]' : 'text-[#94A3B8] line-through'}`}>{a.descripcion}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${a.obligatoria ? 'bg-red-50 text-red-700 border-red-200' : 'bg-[#F1F5F9] text-[#94A3B8] border-[#E2E8F0]'}`}>
                                {a.obligatoria ? 'Obligatoria' : 'Opcional'}
                            </span>
                            <Switch checked={a.activa} onCheckedChange={() => handleToggleActiva(a)} />
                        </div>
                    ))}
                </div>
            )}

            <div className="flex gap-2 mt-4">
                <Input value={nuevaDesc} onChange={(e) => setNuevaDesc(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && agregarActividad()}
                    placeholder="Nueva actividad… (Enter para agregar)"
                    className="flex-1 bg-white border-[#E2E8F0]" id="input-nueva-actividad" />
                <Button onClick={agregarActividad} disabled={!nuevaDesc.trim() || !categoriaId}
                    className="bg-[#1E40AF] hover:bg-[#1E3A8A] text-white gap-1.5">
                    <Plus className="h-4 w-4" /> Agregar
                </Button>
            </div>
            <p className="text-xs text-[#94A3B8] mt-2">💡 Drag & drop para reordenar estará disponible en Bloque 3.</p>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function CatalogosClient({
    categoriasIniciales, insumosIniciales, ubicacionesIniciales, clientesList, tiposIniciales
}: Props) {
    const router = useRouter()
    const [, startTransition] = useTransition()

    function refresh() { startTransition(() => { router.refresh() }) }

    // ── Exportar catálogos ──────────────────────────────────────────────────────

    function exportarCategorias() {
        exportToExcel(
            categoriasIniciales.map((c) => ({
                Nombre:      c.nombre,
                Descripción: c.descripcion ?? '',
                Activa:      c.activa ? 'Sí' : 'No',
            })),
            'categorias'
        )
    }

    function exportarTipos() {
        exportToExcel(
            tiposIniciales.map((t) => ({
                Nombre:               t.nombre,
                'Periodicidad (días)': t.periodicidad_dias,
                Activo:               t.activo ? 'Sí' : 'No',
            })),
            'tipos-mantenimiento'
        )
    }

    function exportarInsumos() {
        exportToExcel(
            insumosIniciales.map((i) => ({
                Nombre:  i.nombre,
                Código:  i.codigo ?? '',
                Unidad:  i.unidad_medida,
                Activo:  i.activo ? 'Sí' : 'No',
            })),
            'insumos'
        )
    }

    function exportarUbicaciones() {
        const clienteMap = Object.fromEntries(clientesList.map((c) => [c.id, c.razon_social]))
        exportToExcel(
            ubicacionesIniciales.map((u) => ({
                Nombre:      u.nombre,
                Cliente:     clienteMap[u.cliente_id] ?? '',
                Descripción: u.descripcion ?? '',
                Activa:      u.activa ? 'Sí' : 'No',
            })),
            'ubicaciones'
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E40AF]/10">
                        <BookOpen className="h-5 w-5 text-[#1E40AF]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[#0F172A] leading-none">Catálogos</h1>
                        <p className="text-sm text-[#94A3B8] mt-0.5">Gestiona categorías, insumos, ubicaciones y checklists</p>
                    </div>
                </div>

                {/* Dropdown exportación */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            className="gap-2 border-[#1E40AF]/20 text-[#1E40AF] hover:bg-blue-50 shrink-0"
                            id="btn-exportar-catalogos"
                        >
                            <Download className="h-4 w-4" />
                            Exportar Excel
                            <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onClick={exportarCategorias}>
                            <Tag className="h-4 w-4 mr-2 text-[#94A3B8]" />
                            Categorías de equipo
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={exportarTipos}>
                            <CheckSquare className="h-4 w-4 mr-2 text-[#94A3B8]" />
                            Tipos de mantenimiento
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={exportarInsumos}>
                            <Package className="h-4 w-4 mr-2 text-[#94A3B8]" />
                            Insumos
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={exportarUbicaciones}>
                            <MapPin className="h-4 w-4 mr-2 text-[#94A3B8]" />
                            Ubicaciones
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <Tabs defaultValue="categorias" className="w-full">
                <TabsList className="bg-[#F1F5F9] border border-[#E2E8F0] h-10">
                    <TabsTrigger value="categorias" className="text-sm gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm" id="tab-categorias">
                        <Tag className="h-3.5 w-3.5" /> Categorías
                    </TabsTrigger>
                    <TabsTrigger value="insumos" className="text-sm gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm" id="tab-insumos">
                        <Package className="h-3.5 w-3.5" /> Insumos
                    </TabsTrigger>
                    <TabsTrigger value="ubicaciones" className="text-sm gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm" id="tab-ubicaciones">
                        <MapPin className="h-3.5 w-3.5" /> Ubicaciones
                    </TabsTrigger>
                    <TabsTrigger value="checklist" className="text-sm gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm" id="tab-checklist">
                        <CheckSquare className="h-3.5 w-3.5" /> Checklist
                    </TabsTrigger>
                </TabsList>

                <div className="mt-6 rounded-xl bg-white border border-[#E2E8F0] shadow-sm p-5">
                    <TabsContent value="categorias" className="mt-0">
                        <TabCategorias inicial={categoriasIniciales} onRefresh={refresh} />
                    </TabsContent>
                    <TabsContent value="insumos" className="mt-0">
                        <TabInsumos inicial={insumosIniciales} onRefresh={refresh} />
                    </TabsContent>
                    <TabsContent value="ubicaciones" className="mt-0">
                        <TabUbicaciones inicial={ubicacionesIniciales} clientesList={clientesList} onRefresh={refresh} />
                    </TabsContent>
                    <TabsContent value="checklist" className="mt-4 outline-none">
                        <TabChecklist categorias={categoriasIniciales} />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}
