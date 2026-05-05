'use client'

import { useState, useTransition } from 'react'
import {
    ScrollText,
    Download,
    Eye,
    ChevronLeft,
    ChevronRight,
    Search
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { getAuditoria } from '@/app/actions/seguridad/auditoria'
import type { RegistroAuditoria, AccionAuditoria, FiltrosAuditoria } from '@/app/actions/seguridad/auditoria'
import type { UsuarioConRoles } from '@/app/actions/seguridad/usuarios'

interface Props {
    datosIniciales: { registros: RegistroAuditoria[]; total: number; pagina: number; totalPaginas: number }
    usuarios: UsuarioConRoles[]
    errorInicial: string | null
}

function formatearFecha(iso: string) {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('es-EC', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(d)
}

function getBadgeColor(accion: string) {
    switch (accion) {
        case 'ADICION': return 'bg-green-50 text-green-700 border-green-200'
        case 'MODIFICACION': return 'bg-amber-50 text-amber-700 border-amber-200'
        case 'ELIMINACION': return 'bg-red-50 text-red-700 border-red-200'
        default: return 'bg-slate-50 text-slate-700 border-slate-200'
    }
}

export default function AuditoriaPageClient({ datosIniciales, usuarios, errorInicial }: Props) {
    const [isPending, startTransition] = useTransition()
    
    // Data state
    const [registros, setRegistros] = useState<RegistroAuditoria[]>(datosIniciales.registros)
    const [total, setTotal] = useState(datosIniciales.total)
    const [paginaActual, setPaginaActual] = useState(datosIniciales.pagina)
    const [totalPaginas, setTotalPaginas] = useState(datosIniciales.totalPaginas)
    
    // Filters state
    const [filtroTabla, setFiltroTabla] = useState('')
    const [filtroAccion, setFiltroAccion] = useState<string>('todos')
    const [filtroUsuario, setFiltroUsuario] = useState<string>('todos')
    const [fechaDesde, setFechaDesde] = useState('')
    const [fechaHasta, setFechaHasta] = useState('')

    // Modal state
    const [detalleAbierto, setDetalleAbierto] = useState(false)
    const [detalleJson, setDetalleJson] = useState<Record<string, unknown> | null>(null)

    async function cargarDatos(filtrosOverride?: Partial<FiltrosAuditoria>) {
        const payload: FiltrosAuditoria = {
            pagina: filtrosOverride?.pagina ?? 1,
            tabla: filtrosOverride?.tabla ?? (filtroTabla.trim() || undefined),
            accion: (filtrosOverride?.accion ?? filtroAccion) === 'todos' ? undefined : ((filtrosOverride?.accion ?? filtroAccion) as AccionAuditoria),
            usuario_id: (filtrosOverride?.usuario_id ?? filtroUsuario) === 'todos' ? undefined : (filtrosOverride?.usuario_id ?? filtroUsuario),
            fecha_desde: filtrosOverride?.fecha_desde ?? (fechaDesde || undefined),
            fecha_hasta: filtrosOverride?.fecha_hasta ?? (fechaHasta || undefined),
        }

        startTransition(async () => {
            const result = await getAuditoria(payload)
            if (result.data) {
                setRegistros(result.data.registros)
                setTotal(result.data.total)
                setPaginaActual(result.data.pagina)
                setTotalPaginas(result.data.totalPaginas)
            }
        })
    }

    function handleFiltrar(e?: React.FormEvent) {
        if (e) e.preventDefault()
        cargarDatos({ pagina: 1 })
    }

    function handleLimpiar() {
        setFiltroTabla('')
        setFiltroAccion('todos')
        setFiltroUsuario('todos')
        setFechaDesde('')
        setFechaHasta('')
        
        cargarDatos({
            pagina: 1,
            tabla: undefined,
            accion: 'todos' as unknown as AccionAuditoria,
            usuario_id: 'todos',
            fecha_desde: undefined,
            fecha_hasta: undefined
        })
    }

    function cambiarPagina(nuevaPagina: number) {
        if (nuevaPagina < 1 || nuevaPagina > totalPaginas) return
        cargarDatos({ pagina: nuevaPagina })
    }

    function verDetalle(detalle: Record<string, unknown> | null) {
        setDetalleJson(detalle)
        setDetalleAbierto(true)
    }

    function exportarCsv() {
        const headers = ['FECHA/HORA', 'USUARIO', 'ACCIÓN', 'TABLA', 'REGISTRO ID', 'DETALLE']
        
        const filas = registros.map(r => {
            return [
                formatearFecha(r.created_at).replace(/,/g, ''),
                r.usuario_nombre || 'Usuario eliminado',
                r.accion,
                r.tabla,
                r.registro_id,
                r.detalle ? JSON.stringify(r.detalle).replace(/"/g, '""') : 'Sin detalle'
            ].map(col => `"${col}"`).join(',')
        })

        const csvContent = [headers.join(','), ...filas].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `auditoria_${new Date().toISOString().split('T')[0]}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <div className="space-y-6">
            {/* ── Encabezado ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E40AF]/10">
                        <ScrollText className="h-5 w-5 text-[#1E40AF]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[#0F172A] leading-none">Auditoría</h1>
                        <p className="text-sm text-[#94A3B8] mt-0.5">
                            Registro de acciones del sistema
                        </p>
                    </div>
                </div>
                <Button 
                    onClick={exportarCsv}
                    variant="outline"
                    className="border-[#E2E8F0] text-[#0F172A] hover:bg-[#F8FAFC]"
                >
                    <Download className="h-4 w-4 mr-2 text-[#64748B]" />
                    Exportar CSV
                </Button>
            </div>

            {errorInicial && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorInicial}
                </div>
            )}

            {/* ── Filtros ── */}
            <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm">
                <form onSubmit={handleFiltrar} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                    <div className="lg:col-span-2 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                        <Input
                            placeholder="Buscar tabla..."
                            value={filtroTabla}
                            onChange={(e) => setFiltroTabla(e.target.value)}
                            className="pl-9 border-[#E2E8F0]"
                        />
                    </div>
                    
                    <Select value={filtroUsuario} onValueChange={(val) => { setFiltroUsuario(val); handleFiltrar() }}>
                        <SelectTrigger className="border-[#E2E8F0]">
                            <SelectValue placeholder="Usuario" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos los usuarios</SelectItem>
                            {usuarios.map(u => (
                                <SelectItem key={u.id} value={u.id}>{u.nombre} {u.apellido}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={filtroAccion} onValueChange={(val) => { setFiltroAccion(val); handleFiltrar() }}>
                        <SelectTrigger className="border-[#E2E8F0]">
                            <SelectValue placeholder="Acción" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todas las acciones</SelectItem>
                            <SelectItem value="ADICION">ADICION</SelectItem>
                            <SelectItem value="MODIFICACION">MODIFICACION</SelectItem>
                            <SelectItem value="ELIMINACION">ELIMINACION</SelectItem>
                        </SelectContent>
                    </Select>

                    <Input
                        type="date"
                        value={fechaDesde}
                        onChange={(e) => { setFechaDesde(e.target.value); handleFiltrar() }}
                        className="border-[#E2E8F0]"
                        title="Fecha desde"
                    />
                    
                    <Input
                        type="date"
                        value={fechaHasta}
                        onChange={(e) => { setFechaHasta(e.target.value); handleFiltrar() }}
                        className="border-[#E2E8F0]"
                        title="Fecha hasta"
                    />
                </form>
                
                <div className="mt-3 flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={handleLimpiar} className="text-[#64748B] hover:text-[#0F172A]">
                        Limpiar filtros
                    </Button>
                    <Button size="sm" onClick={handleFiltrar} className="bg-[#1E40AF] hover:bg-[#1E3A8A] text-white">
                        Aplicar
                    </Button>
                </div>
            </div>

            {/* ── Tabla ── */}
            <div className="rounded-xl bg-white border border-[#E2E8F0] shadow-sm overflow-hidden relative">
                {isPending && (
                    <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-[1px] flex items-center justify-center">
                        <div className="h-6 w-6 border-2 border-[#1E40AF] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
                
                <Table>
                    <TableHeader>
                        <TableRow className="bg-[#F8FAFC] hover:bg-[#F8FAFC]">
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 pl-5">
                                Fecha/Hora
                            </TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3">
                                Usuario
                            </TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3">
                                Acción
                            </TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3">
                                Tabla
                            </TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 hidden md:table-cell">
                                Registro ID
                            </TableHead>
                            <TableHead className="text-xs font-semibold text-[#334155] uppercase tracking-wide py-3 text-right pr-5">
                                Detalle
                            </TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {registros.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="py-16 text-center">
                                    <div className="flex flex-col items-center justify-center">
                                        <ScrollText className="h-8 w-8 text-[#E2E8F0] mb-3" />
                                        <p className="text-sm font-medium text-[#64748B]">No hay registros de auditoría</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            registros.map(r => (
                                <TableRow 
                                    key={r.id} 
                                    className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors cursor-pointer group"
                                    onClick={() => verDetalle(r.detalle)}
                                >
                                    <TableCell className="py-3.5 pl-5 text-sm text-[#334155]">
                                        {formatearFecha(r.created_at)}
                                    </TableCell>
                                    <TableCell className="py-3.5">
                                        {r.usuario_nombre ? (
                                            <span className="text-sm font-semibold text-[#0F172A]">{r.usuario_nombre}</span>
                                        ) : (
                                            <span className="text-xs text-[#94A3B8] italic">Usuario eliminado</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="py-3.5">
                                        <Badge variant="outline" className={`font-semibold px-2 py-0.5 text-[10px] uppercase tracking-wider border rounded-sm ${getBadgeColor(r.accion)}`}>
                                            {r.accion}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="py-3.5">
                                        <code className="bg-[#F1F5F9] text-[#475569] px-1.5 py-0.5 rounded text-[11px] font-mono border border-[#E2E8F0]">
                                            {r.tabla}
                                        </code>
                                    </TableCell>
                                    <TableCell className="py-3.5 hidden md:table-cell">
                                        <code className="text-[#64748B] font-mono text-[11px]" title={r.registro_id}>
                                            {r.registro_id.substring(0, 8)}...
                                        </code>
                                    </TableCell>
                                    <TableCell className="py-3.5 pr-5 text-right" onClick={(e) => e.stopPropagation()}>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => verDetalle(r.detalle)}
                                            className="h-8 w-8 p-0 text-[#94A3B8] hover:text-[#1E40AF] hover:bg-blue-50"
                                            title="Ver detalle"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                {/* ── Paginación ── */}
                {total > 0 && (
                    <div className="px-5 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
                        <p className="text-xs text-[#64748B]">
                            Página <span className="font-medium text-[#0F172A]">{paginaActual}</span> de <span className="font-medium text-[#0F172A]">{totalPaginas}</span>
                            <span className="hidden sm:inline"> · {total} registros en total</span>
                        </p>
                        <div className="flex gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => cambiarPagina(paginaActual - 1)}
                                disabled={paginaActual <= 1 || isPending}
                                className="h-8 border-[#E2E8F0] text-[#334155]"
                            >
                                <ChevronLeft className="h-4 w-4 sm:mr-1" />
                                <span className="hidden sm:inline">Anterior</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => cambiarPagina(paginaActual + 1)}
                                disabled={paginaActual >= totalPaginas || isPending}
                                className="h-8 border-[#E2E8F0] text-[#334155]"
                            >
                                <span className="hidden sm:inline">Siguiente</span>
                                <ChevronRight className="h-4 w-4 sm:ml-1" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Modal Detalle JSON ── */}
            <Dialog open={detalleAbierto} onOpenChange={setDetalleAbierto}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold text-[#0F172A]">Detalle del Registro</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        {detalleJson ? (
                            <pre className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-4 text-xs font-mono text-[#334155] overflow-auto max-h-[400px]">
                                {JSON.stringify(detalleJson, null, 2)}
                            </pre>
                        ) : (
                            <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg text-center text-sm text-[#64748B]">
                                Sin detalle registrado para esta acción.
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
