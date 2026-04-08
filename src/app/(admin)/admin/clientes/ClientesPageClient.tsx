'use client'

/**
 * src/app/(admin)/admin/clientes/ClientesPageClient.tsx
 * Shell Client para la página de Clientes.
 * Recibe datos del Server Component y maneja interactividad:
 * buscador, modal crear/editar, llamadas a server actions.
 */

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Users, AlertCircle, Download } from 'lucide-react'
import { exportToExcel } from '@/lib/exportToExcel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import ClientesTable from '@/components/admin/clientes/ClientesTable'
import ClienteForm from '@/components/admin/clientes/ClienteForm'
import { createCliente, updateCliente } from '@/app/actions/clientes'
import type { Cliente } from '@/types'
import type { ClienteFormValues } from '@/components/admin/clientes/ClienteForm'

interface Props {
    clientesIniciales: Cliente[]
    errorInicial: string | null
}

export default function ClientesPageClient({ clientesIniciales, errorInicial }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    const [busqueda, setBusqueda] = useState('')
    const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'inactivo'>('todos')
    const [modalAbierto, setModalAbierto] = useState(false)
    const [clienteEditando, setClienteEditando] = useState<Cliente | undefined>()
    const [modoForm, setModoForm] = useState<'crear' | 'editar'>('crear')
    const [errorForm, setErrorForm] = useState<string | null>(null)

    // Filtrado local combinado: texto + estado
    const clientesFiltrados = useMemo(() => {
        const q = busqueda.trim().toLowerCase()
        return clientesIniciales.filter((c) => {
            const matchTexto = !q ||
                c.razon_social.toLowerCase().includes(q) ||
                (c.ruc?.toLowerCase().includes(q) ?? false)
            const matchEstado =
                filtroEstado === 'todos' ||
                (filtroEstado === 'activo' ? c.activo : !c.activo)
            return matchTexto && matchEstado
        })
    }, [clientesIniciales, busqueda, filtroEstado])

    function handleExportar() {
        exportToExcel(
            clientesFiltrados.map((c) => ({
                'Razón Social':  c.razon_social,
                RUC:             c.ruc ?? '',
                Email:           c.email ?? '',
                Teléfono:        c.telefono ?? '',
                Dirección:       c.direccion ?? '',
                Activo:          c.activo ? 'Sí' : 'No',
            })),
            'clientes'
        )
    }

    function abrirCrear() {
        setClienteEditando(undefined)
        setModoForm('crear')
        setErrorForm(null)
        setModalAbierto(true)
    }

    function abrirEditar(cliente: Cliente) {
        setClienteEditando(cliente)
        setModoForm('editar')
        setErrorForm(null)
        setModalAbierto(true)
    }

    function cerrarModal() {
        setModalAbierto(false)
        setClienteEditando(undefined)
        setErrorForm(null)
    }

    /**
     * Guarda un cliente (crear o editar) llamando a la server action correspondiente.
     * Usa router.refresh() para recargar los datos del Server Component sin navegar.
     */
    async function handleGuardar(valores: ClienteFormValues) {
        setErrorForm(null)

        const payload = {
            razon_social: valores.razon_social,
            ruc: valores.ruc || null,
            email: valores.email || null,
            telefono: valores.telefono || null,
            direccion: valores.direccion || null,
            activo: valores.activo === 'true',
        }

        let result
        if (modoForm === 'crear') {
            result = await createCliente(payload)
        } else if (clienteEditando) {
            result = await updateCliente(clienteEditando.id, payload)
        } else return

        if (result.error) {
            setErrorForm(result.error)
            return
        }

        cerrarModal()
        startTransition(() => { router.refresh() })
    }

    return (
        <div className="space-y-6">
            {/* ── Encabezado */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E40AF]/10">
                        <Users className="h-5 w-5 text-[#1E40AF]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[#0F172A] leading-none">
                            Clientes
                        </h1>
                        <p className="text-sm text-[#94A3B8] mt-0.5">
                            {clientesIniciales.filter((c) => c.activo).length} activos
                            {' · '}
                            {clientesIniciales.length} en total
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={handleExportar}
                        className="gap-2 border-[#1E40AF]/20 text-[#1E40AF] hover:bg-blue-50 shrink-0"
                        id="btn-exportar-clientes"
                    >
                        <Download className="h-4 w-4" />
                        Exportar Excel
                    </Button>
                    <Button
                        onClick={abrirCrear}
                        className="bg-[#1E40AF] hover:bg-[#1E3A8A] text-white gap-2 shrink-0"
                        id="btn-nuevo-cliente"
                    >
                        <Plus className="h-4 w-4" />
                        Nuevo Cliente
                    </Button>
                </div>
            </div>

            {/* ── Error de carga inicial */}
            {errorInicial && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {errorInicial}
                </div>
            )}

            {/* ── Filtros: búsqueda + estado */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8] pointer-events-none" />
                    <Input
                        id="buscar-cliente"
                        type="search"
                        placeholder="Buscar por nombre o RUC…"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        className="pl-9 bg-white border-[#E2E8F0]"
                    />
                </div>

                <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as typeof filtroEstado)}>
                    <SelectTrigger className="w-44 bg-white border-[#E2E8F0]" id="filtro-estado-cliente">
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
                        onClick={() => { setBusqueda(''); setFiltroEstado('todos') }}
                        className="text-xs text-[#94A3B8] hover:text-[#334155]">
                        Limpiar filtros
                    </Button>
                )}
            </div>

            {/* ── Tabla */}
            <div className="rounded-xl bg-white border border-[#E2E8F0] shadow-sm overflow-hidden">
                <ClientesTable
                    clientes={clientesFiltrados}
                    onVerDetalle={(id) => router.push(`/admin/clientes/${id}`)}
                    onEditar={abrirEditar}
                />
                <div className="px-4 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC]">
                    <p className="text-xs text-[#94A3B8]">
                        {isPending ? 'Actualizando…' : `Mostrando ${clientesFiltrados.length} de ${clientesIniciales.length} clientes`}
                    </p>
                </div>
            </div>

            {/* ── Modal Formulario */}
            <Dialog open={modalAbierto} onOpenChange={(open) => !open && cerrarModal()}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-[#0F172A]">
                            {modoForm === 'crear' ? 'Nuevo Cliente' : 'Editar Cliente'}
                        </DialogTitle>
                        <DialogDescription className="text-[#94A3B8]">
                            {modoForm === 'crear'
                                ? 'Completa los datos para registrar un nuevo cliente.'
                                : `Editando: ${clienteEditando?.razon_social}`}
                        </DialogDescription>
                    </DialogHeader>

                    {errorForm && (
                        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            {errorForm}
                        </div>
                    )}

                    <ClienteForm
                        modo={modoForm}
                        clienteInicial={clienteEditando}
                        onGuardar={handleGuardar}
                        onCancelar={cerrarModal}
                    />
                </DialogContent>
            </Dialog>
        </div>
    )
}
