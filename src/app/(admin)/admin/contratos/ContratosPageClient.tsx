'use client'

/**
 * src/app/(admin)/admin/contratos/ContratosPageClient.tsx
 * Shell Client para la página de Contratos.
 */

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, FileText, AlertCircle, Download } from 'lucide-react'
import { exportToExcel } from '@/lib/exportToExcel'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import ContratosTable from '@/components/admin/contratos/ContratosTable'
import ContratoForm from '@/components/admin/contratos/ContratoForm'
import { createContrato, updateContrato } from '@/app/actions/contratos'
import { computarEstadoContrato } from '@/types'
import type { Contrato, Cliente, EstadoContrato } from '@/types'
import type { ContratoConCliente } from '@/app/actions/contratos'
import type { ContratoFormValues } from '@/components/admin/contratos/ContratoForm'

const ESTADOS_CONTRATO = [
    { value: 'todos', label: 'Todos los estados' },
    { value: 'activo', label: 'Activo' },
    { value: 'vencido', label: 'Vencido' },
    { value: 'suspendido', label: 'Suspendido' },
    { value: 'cancelado', label: 'Cancelado' },
]

interface Props {
    contratosIniciales: ContratoConCliente[]
    clientesList: Cliente[]
    errorInicial: string | null
}

export default function ContratosPageClient({ contratosIniciales, clientesList, errorInicial }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [filtroEstado, setFiltroEstado] = useState<EstadoContrato | 'todos'>('todos')
    const [filtroCliente, setFiltroCliente] = useState('todos')
    const [modalAbierto, setModalAbierto] = useState(false)
    const [contratoEditando, setContratoEditando] = useState<Contrato | undefined>()
    const [modoForm, setModoForm] = useState<'crear' | 'editar'>('crear')
    const [errorForm, setErrorForm] = useState<string | null>(null)

    const contratosFiltrados = useMemo(() => {
        return contratosIniciales.filter((c) => {
            const estadoOk = filtroEstado === 'todos' || computarEstadoContrato(c) === filtroEstado
            const clienteOk = filtroCliente === 'todos' || c.cliente_id === filtroCliente
            return estadoOk && clienteOk
        })
    }, [contratosIniciales, filtroEstado, filtroCliente])

    const countByEstado = useMemo(() => {
        const counts: Record<string, number> = { todos: contratosIniciales.length }
        contratosIniciales.forEach((c) => {
            const e = computarEstadoContrato(c)
            counts[e] = (counts[e] ?? 0) + 1
        })
        return counts
    }, [contratosIniciales])

    function handleExportar() {
        const clienteMap = Object.fromEntries(clientesList.map((c) => [c.id, c.razon_social]))
        exportToExcel(
            contratosFiltrados.map((c) => ({
                'Código contrato': c.numero_contrato,
                Cliente:          clienteMap[c.cliente_id] ?? c.cliente_id,
                'Fecha inicio':   c.fecha_inicio,
                'Fecha fin':      c.fecha_fin ?? '',
                Estado:           computarEstadoContrato(c),
                Activo:           c.activo ? 'Sí' : 'No',
            })),
            'contratos'
        )
    }

    function cerrarModal() { setModalAbierto(false); setContratoEditando(undefined); setErrorForm(null) }

    async function handleGuardar(valores: ContratoFormValues) {
        setErrorForm(null)
        const payload = {
            cliente_id: valores.cliente_id,
            numero_contrato: valores.numero_contrato,
            fecha_inicio: valores.fecha_inicio,
            fecha_fin: valores.fecha_fin || null,
            tipo_contrato: valores.tipo_contrato,
            observaciones: valores.observaciones || null,
            activo: valores.estado_display !== 'cancelado',
        }

        const result = modoForm === 'crear'
            ? await createContrato(payload)
            : await updateContrato(contratoEditando!.id, payload)

        if (result.error) { setErrorForm(result.error); return }
        cerrarModal()
        startTransition(() => { router.refresh() })
    }

    return (
        <div className="space-y-6">
            {/* Encabezado */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E40AF]/10">
                        <FileText className="h-5 w-5 text-[#1E40AF]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[#0F172A] leading-none">Contratos</h1>
                        <p className="text-sm text-[#94A3B8] mt-0.5">
                            {countByEstado['activo'] ?? 0} activos · {contratosIniciales.length} en total
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={handleExportar}
                        className="gap-2 border-[#1E40AF]/20 text-[#1E40AF] hover:bg-blue-50 shrink-0"
                        id="btn-exportar-contratos"
                    >
                        <Download className="h-4 w-4" />
                        Exportar Excel
                    </Button>
                    <Button onClick={() => { setModoForm('crear'); setContratoEditando(undefined); setErrorForm(null); setModalAbierto(true) }}
                        className="bg-[#1E40AF] hover:bg-[#1E3A8A] text-white gap-2 shrink-0" id="btn-nuevo-contrato">
                        <Plus className="h-4 w-4" /> Nuevo Contrato
                    </Button>
                </div>
            </div>

            {errorInicial && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />{errorInicial}
                </div>
            )}

            {/* Filtros */}
            <div className="flex flex-wrap gap-3 items-center">
                <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as EstadoContrato | 'todos')}>
                    <SelectTrigger className="w-48 bg-white border-[#E2E8F0]" id="filtro-estado"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {ESTADOS_CONTRATO.map((e) => (
                            <SelectItem key={e.value} value={e.value}>
                                {e.label}{e.value !== 'todos' ? ` (${countByEstado[e.value] ?? 0})` : ` (${countByEstado['todos']})`}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={filtroCliente} onValueChange={setFiltroCliente}>
                    <SelectTrigger className="w-56 bg-white border-[#E2E8F0]" id="filtro-cliente"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos los clientes</SelectItem>
                        {clientesList.map((c) => <SelectItem key={c.id} value={c.id}>{c.razon_social}</SelectItem>)}
                    </SelectContent>
                </Select>

                {(filtroEstado !== 'todos' || filtroCliente !== 'todos') && (
                    <Button variant="ghost" size="sm" onClick={() => { setFiltroEstado('todos'); setFiltroCliente('todos') }}
                        className="text-xs text-[#94A3B8] hover:text-[#334155]">Limpiar filtros</Button>
                )}
            </div>

            {/* Tabla */}
            <div className="rounded-xl bg-white border border-[#E2E8F0] shadow-sm overflow-hidden">
                <ContratosTable
                    contratos={contratosFiltrados}
                    onVerDetalle={(id) => router.push(`/admin/contratos/${id}`)}
                    onEditar={(c) => { setContratoEditando(c); setModoForm('editar'); setErrorForm(null); setModalAbierto(true) }}
                />
                <div className="px-4 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC]">
                    <p className="text-xs text-[#94A3B8]">
                        {isPending ? 'Actualizando…' : `Mostrando ${contratosFiltrados.length} de ${contratosIniciales.length} contratos`}
                    </p>
                </div>
            </div>

            {/* Modal */}
            <Dialog open={modalAbierto} onOpenChange={(open) => !open && cerrarModal()}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-[#0F172A]">
                            {modoForm === 'crear' ? 'Nuevo Contrato' : 'Editar Contrato'}
                        </DialogTitle>
                        <DialogDescription className="text-[#94A3B8]">
                            {modoForm === 'crear' ? 'Completa los datos para registrar un nuevo contrato.' : `Editando: ${contratoEditando?.numero_contrato}`}
                        </DialogDescription>
                    </DialogHeader>
                    {errorForm && (
                        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />{errorForm}
                        </div>
                    )}
                    <ContratoForm
                        modo={modoForm}
                        contratoInicial={contratoEditando}
                        clientesList={clientesList}
                        onGuardar={handleGuardar}
                        onCancelar={cerrarModal}
                    />
                </DialogContent>
            </Dialog>
        </div>
    )
}
