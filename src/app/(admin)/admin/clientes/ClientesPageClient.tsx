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
import { createCliente, updateCliente, desactivarCliente } from '@/app/actions/clientes'
import { usePuede } from '@/lib/seguridad/PermisosProvider'
import { MODULO, PERMISO } from '@/lib/seguridad/modulos'
import type { Cliente } from '@/types'
import type { ClienteFormValues } from '@/components/admin/clientes/ClienteForm'

interface Props {
    clientesIniciales: Cliente[]
    errorInicial: string | null
}

export default function ClientesPageClient({ clientesIniciales, errorInicial }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    // Ocultar acciones no permitidas. La protección real está en las server
    // actions (requirePermiso); esto solo evita mostrar puertas cerradas.
    const puede = usePuede()
    const puedeCrear    = puede(MODULO.CLIENTES, PERMISO.CREAR)
    const puedeEditar   = puede(MODULO.CLIENTES, PERMISO.EDITAR)
    const puedeEliminar = puede(MODULO.CLIENTES, PERMISO.ELIMINAR)
    const puedeExportar = puede(MODULO.CLIENTES, PERMISO.EXPORTAR)

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
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-marca-suave">
                        <Users className="h-5 w-5 text-marca-tinta" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-tinta leading-none">
                            Clientes
                        </h1>
                        <p className="text-sm text-tinta-tenue mt-0.5">
                            {clientesIniciales.filter((c) => c.activo).length} activos
                            {' · '}
                            {clientesIniciales.length} en total
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {puedeExportar && (
                        <Button
                            variant="outline"
                            onClick={handleExportar}
                            className="gap-2 border-marca-linea text-marca-tinta hover:bg-marca-suave shrink-0"
                            id="btn-exportar-clientes"
                        >
                            <Download className="h-4 w-4" />
                            Exportar Excel
                        </Button>
                    )}
                    {puedeCrear && (
                        <Button
                            onClick={abrirCrear}
                            className="bg-marca hover:bg-marca-fuerte text-white gap-2 shrink-0"
                            id="btn-nuevo-cliente"
                        >
                            <Plus className="h-4 w-4" />
                            Nuevo Cliente
                        </Button>
                    )}
                </div>
            </div>

            {/* ── Error de carga inicial */}
            {errorInicial && (
                <div className="flex items-center gap-2 rounded-lg border border-critico-linea bg-critico-suave px-4 py-3 text-sm text-critico-tinta">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {errorInicial}
                </div>
            )}

            {/* ── Filtros: búsqueda + estado */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tinta-tenue pointer-events-none" />
                    <Input
                        id="buscar-cliente"
                        type="search"
                        placeholder="Buscar por nombre o RUC…"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        className="pl-9 bg-panel border-borde"
                    />
                </div>

                <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as typeof filtroEstado)}>
                    <SelectTrigger className="w-44 bg-panel border-borde" id="filtro-estado-cliente">
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
                        className="text-xs text-tinta-tenue hover:text-tinta-media">
                        Limpiar filtros
                    </Button>
                )}
            </div>

            {/* ── Tabla */}
            <div className="rounded-xl bg-panel border border-borde shadow-sm overflow-hidden">
                <ClientesTable
                    clientes={clientesFiltrados}
                    onVerDetalle={(id) => router.push(`/admin/clientes/${id}`)}
                    onEditar={puedeEditar ? abrirEditar : undefined}
                    onDesactivar={puedeEliminar ? (cliente) => desactivarCliente(cliente.id) : undefined}
                    onDesactivarExito={() => startTransition(() => { router.refresh() })}
                />
                <div className="px-4 py-3 border-t border-borde bg-panel-suave">
                    <p className="text-xs text-tinta-tenue">
                        {isPending ? 'Actualizando…' : `Mostrando ${clientesFiltrados.length} de ${clientesIniciales.length} clientes`}
                    </p>
                </div>
            </div>

            {/* ── Modal Formulario */}
            <Dialog open={modalAbierto} onOpenChange={(open) => !open && cerrarModal()}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-tinta">
                            {modoForm === 'crear' ? 'Nuevo Cliente' : 'Editar Cliente'}
                        </DialogTitle>
                        <DialogDescription className="text-tinta-tenue">
                            {modoForm === 'crear'
                                ? 'Completa los datos para registrar un nuevo cliente.'
                                : `Editando: ${clienteEditando?.razon_social}`}
                        </DialogDescription>
                    </DialogHeader>

                    {errorForm && (
                        <div className="flex items-center gap-2 rounded-lg border border-critico-linea bg-critico-suave px-3 py-2 text-xs text-critico-tinta">
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
