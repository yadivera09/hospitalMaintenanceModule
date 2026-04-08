'use client'

/**
 * src/app/(admin)/admin/tecnicos/TecnicosPageClient.tsx
 * Shell Client para la página de Técnicos.
 */

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, HardHat, Search, AlertCircle, Download } from 'lucide-react'
import { exportToExcel } from '@/lib/exportToExcel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Eye, Pencil } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import TecnicoForm from '@/components/admin/tecnicos/TecnicoForm'
import { createTecnico, updateTecnico, getTecnicos, toggleActivoTecnico } from '@/app/actions/tecnicos'
import type { Tecnico } from '@/types'
import type { TecnicoFormValues } from '@/components/admin/tecnicos/TecnicoForm'

interface Props {
    tecnicosIniciales: Tecnico[]
    errorInicial: string | null
}

function EstadoBadge({ activo }: { activo: boolean }) {
    return activo
        ? <Badge className="bg-green-50 text-green-700 border border-green-200 text-xs">Activo</Badge>
        : <Badge className="bg-[#F1F5F9] text-[#94A3B8] border border-[#E2E8F0] text-xs">Inactivo</Badge>
}

export default function TecnicosPageClient({ tecnicosIniciales, errorInicial }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [busqueda, setBusqueda] = useState('')
    const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'inactivo'>('todos')
    const [lista, setLista] = useState(tecnicosIniciales)
    const [modalAbierto, setModalAbierto] = useState(false)
    const [tecnicoEditando, setTecnicoEditando] = useState<Tecnico | undefined>()
    const [modoForm, setModoForm] = useState<'crear' | 'editar'>('crear')
    const [errorForm, setErrorForm] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Reflejar cambios del SSR si refescamos globalmente y search está vacío
    if (busqueda === '' && lista !== tecnicosIniciales) {
        setLista(tecnicosIniciales)
    }

    async function handleSearch(term: string) {
        setBusqueda(term)
        if (!term) {
            setLista(tecnicosIniciales)
            return
        }
        const { data } = await getTecnicos({ search: term })
        if (data) setLista(data)
    }

    function cerrarModal() {
        setModalAbierto(false)
        setTecnicoEditando(undefined)
        setErrorForm(null)
    }

    async function handleToggle(t: Tecnico) {
        await toggleActivoTecnico(t.id)
        if (busqueda) handleSearch(busqueda)
        else startTransition(() => { router.refresh() })
    }

    async function handleGuardar(valores: TecnicoFormValues) {
        setErrorForm(null)
        setIsSubmitting(true)

        const payload = {
            nombre: valores.nombre,
            apellido: valores.apellido,
            cedula: valores.cedula || null,
            email: valores.email,
            telefono: valores.telefono || null,
            activo: valores.estado_display !== 'inactivo',
        }

        const result = modoForm === 'crear'
            ? await createTecnico(payload)
            : await updateTecnico(tecnicoEditando!.id, payload)

        setIsSubmitting(false)
        if (result.error) { setErrorForm(result.error); return }
        cerrarModal()
        if (busqueda) handleSearch(busqueda)
        else startTransition(() => { router.refresh() })
    }

    // Filtrado local por estado (sobre la lista ya filtrada por búsqueda del servidor)
    const listaFiltrada = useMemo(() => {
        if (filtroEstado === 'todos') return lista
        return lista.filter((t) =>
            filtroEstado === 'activo' ? t.activo : !t.activo
        )
    }, [lista, filtroEstado])

    function handleExportar() {
        exportToExcel(
            listaFiltrada.map((t) => ({
                Nombre:   t.nombre,
                Apellido: t.apellido,
                Cédula:   t.cedula ?? '',
                Email:    t.email,
                Teléfono: t.telefono ?? '',
                Activo:   t.activo ? 'Sí' : 'No',
            })),
            'tecnicos'
        )
    }

    return (
        <div className="space-y-6">
            {/* Encabezado */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E40AF]/10">
                        <HardHat className="h-5 w-5 text-[#1E40AF]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[#0F172A] leading-none">Técnicos</h1>
                        <p className="text-sm text-[#94A3B8] mt-0.5">
                            {tecnicosIniciales.filter((t) => t.activo).length} activos · {tecnicosIniciales.length} en total
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={handleExportar}
                        className="gap-2 border-[#1E40AF]/20 text-[#1E40AF] hover:bg-blue-50 shrink-0"
                        id="btn-exportar-tecnicos"
                    >
                        <Download className="h-4 w-4" />
                        Exportar Excel
                    </Button>
                    <Button onClick={() => { setModoForm('crear'); setTecnicoEditando(undefined); setErrorForm(null); setModalAbierto(true) }}
                        className="bg-[#1E40AF] hover:bg-[#1E3A8A] text-white gap-2 shrink-0" id="btn-nuevo-tecnico">
                        <Plus className="h-4 w-4" /> Nuevo Técnico
                    </Button>
                </div>
            </div>

            {errorInicial && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />{errorInicial}
                </div>
            )}

            {/* Buscador + filtro estado */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8] pointer-events-none" />
                    <Input id="buscar-tecnico" type="search" placeholder="Buscar por nombre o cédula…"
                        value={busqueda} onChange={(e) => handleSearch(e.target.value)} className="pl-9 bg-white border-[#E2E8F0]" />
                </div>

                <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as typeof filtroEstado)}>
                    <SelectTrigger className="w-44 bg-white border-[#E2E8F0]" id="filtro-estado-tecnico">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos los estados</SelectItem>
                        <SelectItem value="activo">Activo</SelectItem>
                        <SelectItem value="inactivo">Inactivo</SelectItem>
                    </SelectContent>
                </Select>

                {(busqueda || filtroEstado !== 'todos') && (
                    <Button variant="ghost" size="sm"
                        onClick={() => { setBusqueda(''); setFiltroEstado('todos'); setLista(tecnicosIniciales) }}
                        className="text-xs text-[#94A3B8] hover:text-[#334155]">
                        Limpiar filtros
                    </Button>
                )}
            </div>

            {/* Tabla */}
            <div className="rounded-xl bg-white border border-[#E2E8F0] shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-[#F8FAFC]">
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase py-3 pl-4">Nombre</TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase py-3 hidden md:table-cell">Cédula</TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase py-3 hidden sm:table-cell">Email</TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase py-3 hidden lg:table-cell">Teléfono</TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase py-3">Estado</TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase py-3 text-right pr-4">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {listaFiltrada.map((t) => (
                            <TableRow key={t.id} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC]">
                                <TableCell className="py-3 pl-4">
                                    <p className="text-sm font-medium text-[#0F172A]">{t.nombre} {t.apellido}</p>
                                </TableCell>
                                <TableCell className="py-3 hidden md:table-cell">
                                    <span className="text-xs font-mono text-[#334155]">{t.cedula ?? '—'}</span>
                                </TableCell>
                                <TableCell className="py-3 hidden sm:table-cell">
                                    <span className="text-sm text-[#334155]">{t.email}</span>
                                </TableCell>
                                <TableCell className="py-3 hidden lg:table-cell">
                                    <span className="text-sm text-[#334155]">{t.telefono ?? '—'}</span>
                                </TableCell>
                                <TableCell className="py-3">
                                    <Switch checked={t.activo} onCheckedChange={() => handleToggle(t)} />
                                </TableCell>
                                <TableCell className="py-3 pr-4 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/tecnicos/${t.id}`)}
                                            className="h-7 w-7 p-0 text-[#94A3B8] hover:text-[#1E40AF] hover:bg-blue-50">
                                            <Eye className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => {
                                            setTecnicoEditando(t); setModoForm('editar'); setErrorForm(null); setModalAbierto(true)
                                        }} className="h-7 w-7 p-0 text-[#94A3B8] hover:text-[#D97706] hover:bg-amber-50">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {listaFiltrada.length === 0 && (
                            <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-[#94A3B8]">Sin técnicos registrados</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
                <div className="px-4 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC]">
                    <p className="text-xs text-[#94A3B8]">
                        {isPending ? 'Actualizando…' : `Mostrando ${listaFiltrada.length} de ${tecnicosIniciales.length} técnicos`}
                    </p>
                </div>
            </div>

            {/* Modal */}
            <Dialog open={modalAbierto} onOpenChange={(open) => !open && cerrarModal()}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-[#0F172A]">
                            {modoForm === 'crear' ? 'Nuevo Técnico' : 'Editar Técnico'}
                        </DialogTitle>
                        <DialogDescription className="text-[#94A3B8]">
                            {modoForm === 'crear' ? 'Registra un nuevo técnico en el sistema.' : `Editando: ${tecnicoEditando?.nombre} ${tecnicoEditando?.apellido}`}
                        </DialogDescription>
                    </DialogHeader>
                    {errorForm && (
                        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />{errorForm}
                        </div>
                    )}
                    <TecnicoForm
                        modo={modoForm}
                        tecnicoInicial={tecnicoEditando}
                        onGuardar={handleGuardar}
                        onCancelar={cerrarModal}
                        isLoading={isSubmitting}
                    />
                </DialogContent>
            </Dialog>
        </div>
    )
}
