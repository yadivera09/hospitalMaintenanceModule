'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
    ShieldCheck,
    ArrowLeft,
    AlertCircle,
    CheckCircle2,
    Info,
    Lock,
    Pencil,
    Trash2,
    Plus,
    Eye,
    Download,
    Ban,
    CheckSquare,
    Square,
    Copy
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { asignarPermisosRol } from '@/app/actions/seguridad/roles'
import type { RolConPermisos, PermisoBase } from '@/app/actions/seguridad/roles'
import type { Menu } from '@/app/actions/seguridad/modulos'

interface Props {
    rol: RolConPermisos
    menus: Menu[]
    permisosCatalogo: PermisoBase[]
}

const ORDEN_CODIGOS = ['ver', 'crear', 'editar', 'eliminar', 'exportar', 'anular']

const ICONS_PERMISOS: Record<string, React.ElementType> = {
    ver: Eye,
    crear: Plus,
    editar: Pencil,
    eliminar: Trash2,
    exportar: Download,
    anular: Ban,
}

function buildEstadoInicial(rol: RolConPermisos): Record<string, Set<string>> {
    const estado: Record<string, Set<string>> = {}
    for (const p of rol.permisos) {
        if (!estado[p.modulo_id]) estado[p.modulo_id] = new Set()
        estado[p.modulo_id].add(p.permiso_id)
    }
    return estado
}

export default function RolDetalleClient({ rol, menus, permisosCatalogo }: Props) {
    const router = useRouter()
    const [, startTransition] = useTransition()

    const permisosOrdenados = ORDEN_CODIGOS
        .map((codigo) => permisosCatalogo.find((p) => p.codigo === codigo))
        .filter((p): p is PermisoBase => p !== undefined)

    const verPermisoId = permisosOrdenados.find((p) => p.codigo === 'ver')?.id ?? null

    const [matriz, setMatriz] = useState<Record<string, Set<string>>>(() =>
        buildEstadoInicial(rol)
    )

    const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'error'; msg: string } | null>(null)
    const [guardando, setGuardando] = useState(false)

    // Estado del modal
    const [modalAbierto, setModalAbierto] = useState(false)
    const [modoModal, setModoModal] = useState<'agregar' | 'editar'>('agregar')
    const [moduloEditando, setModuloEditando] = useState<{ moduloId: string; permisoIds: Set<string> } | null>(null)
    const [ultimosPermisosGuardados, setUltimosPermisosGuardados] = useState<Set<string> | null>(null)

    // Helper: modulos asignados
    const modulosAsignadosIds = Object.keys(matriz).filter(id => matriz[id].size > 0);
    const modulosAsignados = menus
        .flatMap(m => m.modulos)
        .filter(mod => modulosAsignadosIds.includes(mod.id));

    // Helper: Toggle permiso en modal
    function togglePermisoModal(permisoId: string, codigo: string) {
        if (!moduloEditando || !moduloEditando.moduloId) return;
        setUltimosPermisosGuardados(null);
        
        setModuloEditando(prev => {
            if (!prev) return prev;
            const newSet = new Set(prev.permisoIds);
            
            if (newSet.has(permisoId)) {
                newSet.delete(permisoId);
                if (codigo === 'ver') newSet.clear();
            } else {
                newSet.add(permisoId);
                if (codigo !== 'ver' && verPermisoId) newSet.add(verPermisoId);
            }
            return { ...prev, permisoIds: newSet };
        });
    }

    // Helper: Guardar desde modal
    async function handleGuardarModal(accion: 'continuar' | 'salir') {
        if (!moduloEditando || !moduloEditando.moduloId) return;
        
        // Validacion
        if (moduloEditando.permisoIds.size === 0) {
            setFeedback({ tipo: 'error', msg: 'Debe seleccionar al menos un permiso para el módulo.' });
            return;
        }

        setGuardando(true);
        setFeedback(null);
        
        const newMatriz = { ...matriz, [moduloEditando.moduloId]: moduloEditando.permisoIds };
        
        const permisos: { moduloId: string; permisoId: string }[] = []
        Object.entries(newMatriz).forEach(([modId, permisoSet]) => {
            Array.from(permisoSet).forEach(permisoId => {
                permisos.push({ moduloId: modId, permisoId })
            })
        })
        
        const result = await asignarPermisosRol(rol.id, permisos)
        setGuardando(false)
        
        if (result.error) {
            setFeedback({ tipo: 'error', msg: result.error })
        } else {
            setFeedback({ tipo: 'ok', msg: 'Permisos actualizados correctamente.' })
            setMatriz(newMatriz);
            startTransition(() => { router.refresh() });
            
            if (accion === 'continuar') {
                setUltimosPermisosGuardados(new Set(moduloEditando.permisoIds));
                setModuloEditando({ moduloId: '', permisoIds: new Set(moduloEditando.permisoIds) });
            } else {
                setModalAbierto(false);
            }
        }
    }

    async function handleQuitar(moduloId: string) {
        if (!confirm('¿Estás seguro de quitar todos los permisos de este módulo?')) return;
        setGuardando(true);
        setFeedback(null);
        
        const newMatriz = { ...matriz };
        delete newMatriz[moduloId];
        
        const permisos: { moduloId: string; permisoId: string }[] = []
        Object.entries(newMatriz).forEach(([modId, permisoSet]) => {
            Array.from(permisoSet).forEach(permisoId => {
                permisos.push({ moduloId: modId, permisoId })
            })
        })
        
        const result = await asignarPermisosRol(rol.id, permisos)
        setGuardando(false)
        
        if (result.error) {
            setFeedback({ tipo: 'error', msg: result.error })
        } else {
            setFeedback({ tipo: 'ok', msg: 'Módulo quitado correctamente.' })
            setMatriz(newMatriz);
            startTransition(() => { router.refresh() });
        }
    }

    function abrirModalAgregar() {
        setModoModal('agregar');
        setModuloEditando({ moduloId: '', permisoIds: new Set() });
        setUltimosPermisosGuardados(null);
        setFeedback(null);
        setModalAbierto(true);
    }

    function abrirModalEditar(moduloId: string) {
        setModoModal('editar');
        setModuloEditando({ moduloId, permisoIds: new Set(matriz[moduloId] || []) });
        setFeedback(null);
        setModalAbierto(true);
    }

    const todosSeleccionados = moduloEditando ? permisosOrdenados.length > 0 && moduloEditando.permisoIds.size === permisosOrdenados.length : false;

    function toggleTodosPermisos() {
        if (!moduloEditando || !moduloEditando.moduloId) return;
        setUltimosPermisosGuardados(null);
        if (todosSeleccionados) {
            setModuloEditando({ ...moduloEditando, permisoIds: new Set() });
        } else {
            setModuloEditando({ ...moduloEditando, permisoIds: new Set(permisosOrdenados.map(p => p.id)) });
        }
    }

    return (
        <div className="space-y-6">

            {/* ── Encabezado ── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push('/admin/seguridad/roles')}
                        className="h-8 px-2 text-tinta-tenue hover:text-tinta hover:bg-panel-suave -ml-1"
                    >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Roles
                    </Button>

                    <span className="text-borde">/</span>

                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-marca-suave">
                            <ShieldCheck className="h-5 w-5 text-marca-tinta" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-xl font-bold text-tinta leading-none">
                                    {rol.nombre}
                                </h1>
                                {rol.es_sistema ? (
                                    <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 gap-1 rounded-sm text-[10px] py-0.5 px-2 font-medium">
                                        <Lock className="h-2.5 w-2.5" />
                                        Sistema
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="bg-panel-suave text-tinta-media border-borde rounded-sm text-[10px] py-0.5 px-2 font-medium">
                                        Custom
                                    </Badge>
                                )}
                            </div>
                            {rol.descripcion && (
                                <p className="text-sm text-tinta-tenue mt-0.5">{rol.descripcion}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Banner informativo para roles de sistema ── */}
            {rol.es_sistema && (
                <div className="flex items-start gap-3 rounded-lg border border-marca-linea bg-marca-suave px-4 py-3">
                    <Info className="h-4 w-4 text-marca-tinta shrink-0 mt-0.5" />
                    <p className="text-sm text-marca-tinta">
                        Este es un <strong>rol de sistema</strong>. Puedes editar sus permisos libremente,
                        pero no puedes cambiar su nombre ni eliminarlo.
                    </p>
                </div>
            )}

            {/* ── Feedback inline principal ── */}
            {feedback && !modalAbierto && (
                <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
                    feedback.tipo === 'ok'
                        ? 'border-ok-linea bg-ok-suave text-ok-tinta'
                        : 'border-critico-linea bg-critico-suave text-critico-tinta'
                }`}>
                    {feedback.tipo === 'ok'
                        ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                        : <AlertCircle className="h-4 w-4 shrink-0" />
                    }
                    {feedback.msg}
                </div>
            )}

            {/* ── Tabla de Módulos Asignados ── */}
            <div className="bg-panel rounded-xl border border-borde shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-borde">
                    <h2 className="text-base font-semibold text-tinta">Módulos y Permisos</h2>
                    <Button 
                        size="sm" 
                        onClick={abrirModalAgregar}
                        className="bg-marca hover:bg-marca-fuerte text-white gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Agregar módulo
                    </Button>
                </div>

                {modulosAsignados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <ShieldCheck className="h-10 w-10 text-borde mb-3" />
                        <p className="text-sm font-medium text-tinta-media">Este rol no tiene módulos asignados aún</p>
                        <p className="text-xs text-tinta-tenue mt-1">
                            Haz clic en "Agregar módulo" para comenzar a configurar los permisos.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-panel-suave text-xs uppercase text-tinta-media font-medium border-b border-borde">
                                <tr>
                                    <th className="px-5 py-3 whitespace-nowrap">Módulo</th>
                                    <th className="px-5 py-3 whitespace-nowrap">URL</th>
                                    <th className="px-5 py-3">Permisos Asignados</th>
                                    <th className="px-5 py-3 whitespace-nowrap text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-borde-suave">
                                {modulosAsignados.map(mod => {
                                    const permisosMod = Array.from(matriz[mod.id] || []).map(id => permisosCatalogo.find(p => p.id === id)).filter(Boolean) as PermisoBase[];
                                    // Sort to match canonical order
                                    permisosMod.sort((a, b) => ORDEN_CODIGOS.indexOf(a.codigo) - ORDEN_CODIGOS.indexOf(b.codigo));
                                    
                                    return (
                                        <tr key={mod.id} className="hover:bg-panel-suave transition-colors">
                                            <td className="px-5 py-3">
                                                <span className="font-medium text-tinta">{mod.nombre}</span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className="text-tinta-media font-mono text-xs">{mod.url}</span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {permisosMod.map(p => (
                                                        <Badge key={p.id} variant="secondary" className="bg-marca-suave text-marca-tinta hover:bg-marca-suave text-[10px] py-0 px-1.5 font-medium border-marca-linea">
                                                            {p.nombre}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-tinta-media hover:text-marca-tinta" onClick={() => abrirModalEditar(mod.id)}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-tinta-media hover:text-critico-tinta hover:bg-critico-suave" onClick={() => handleQuitar(mod.id)} disabled={guardando}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Modal de Asignación ── */}
            <Dialog open={modalAbierto} onOpenChange={(open) => {
                if (!open && !guardando) setModalAbierto(false)
            }}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {modoModal === 'agregar' ? 'Agregar módulo al rol' : 'Editar permisos de módulo'}
                        </DialogTitle>
                        <DialogDescription>
                            {modoModal === 'agregar' 
                                ? 'Selecciona el módulo y define qué acciones puede realizar este rol' 
                                : 'Modifica los permisos de acceso para este módulo'}
                        </DialogDescription>
                    </DialogHeader>

                    {feedback && modalAbierto && (
                        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                            feedback.tipo === 'ok'
                                ? 'border-ok-linea bg-ok-suave text-ok-tinta'
                                : 'border-critico-linea bg-critico-suave text-critico-tinta'
                        }`}>
                            {feedback.tipo === 'ok'
                                ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                                : <AlertCircle className="h-4 w-4 shrink-0" />
                            }
                            {feedback.msg}
                        </div>
                    )}

                    <div className="py-4 space-y-3">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-tinta-media">Módulo</label>
                            <Select 
                                value={moduloEditando?.moduloId || ''} 
                                onValueChange={(val) => {
                                    setModuloEditando(prev => ({ 
                                        moduloId: val, 
                                        permisoIds: prev ? prev.permisoIds : new Set() 
                                    }));
                                    setFeedback(null);
                                }}
                                disabled={modoModal === 'editar' || guardando}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione un módulo..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-[240px] overflow-y-auto">
                                    {menus.filter(m => m.activo).map(menu => {
                                        const unassignedMods = menu.modulos.filter(m => {
                                            if (!m.activo) return false;
                                            if (modoModal === 'editar') return m.id === moduloEditando?.moduloId;
                                            return !matriz[m.id] || matriz[m.id].size === 0;
                                        });
                                        if (unassignedMods.length === 0) return null;
                                        return (
                                            <SelectGroup key={menu.id}>
                                                <SelectLabel className="text-tinta-tenue font-semibold text-xs tracking-wider uppercase flex justify-center py-2">
                                                    ── {menu.nombre} ──
                                                </SelectLabel>
                                                {unassignedMods.map(m => (
                                                    <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
                                                ))}
                                            </SelectGroup>
                                        )
                                    })}
                                </SelectContent>
                            </Select>
                            {ultimosPermisosGuardados !== null && modoModal === 'agregar' && (
                                <div className="flex items-center gap-1.5 text-xs text-tinta-tenue pt-1">
                                    <Copy className="h-3.5 w-3.5" />
                                    Se copiaron los permisos del módulo anterior
                                </div>
                            )}
                        </div>

                        {moduloEditando?.moduloId && (
                            <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium text-tinta-media">Permisos</label>
                                    <button 
                                        type="button" 
                                        onClick={toggleTodosPermisos} 
                                        className="flex items-center gap-1.5 text-xs text-tinta-media hover:text-marca-tinta"
                                    >
                                        {todosSeleccionados ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                        {todosSeleccionados ? 'Quitar todos' : 'Seleccionar todos'}
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {permisosOrdenados.map((permiso) => {
                                        const isChecked = moduloEditando.permisoIds.has(permiso.id);
                                        const Icon = ICONS_PERMISOS[permiso.codigo] || ShieldCheck;
                                        return (
                                            <label 
                                                key={permiso.id} 
                                                className={`relative flex flex-col items-center justify-center p-2 gap-1 w-[80px] h-[72px] rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                                                    isChecked 
                                                        ? 'bg-marca-suave border-marca text-marca-tinta' 
                                                        : 'bg-panel border-borde text-tinta-tenue hover:border-borde hover:bg-panel-suave'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => togglePermisoModal(permiso.id, permiso.codigo)}
                                                    disabled={guardando}
                                                    className="sr-only"
                                                />
                                                <Icon className={`h-4 w-4 ${isChecked ? 'text-marca-tinta' : 'text-tinta-tenue'}`} />
                                                <span className={`text-[10px] font-semibold ${isChecked ? 'text-marca-tinta' : 'text-tinta-media'}`}>
                                                    {permiso.nombre}
                                                </span>
                                            </label>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-2 pt-4 border-t border-borde">
                        <Button 
                            variant="outline" 
                            onClick={() => setModalAbierto(false)}
                            disabled={guardando}
                        >
                            Cancelar
                        </Button>
                        {modoModal === 'agregar' && (
                            <Button 
                                onClick={() => handleGuardarModal('continuar')}
                                disabled={guardando || !moduloEditando?.moduloId}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                {guardando ? 'Guardando...' : 'Guardar y continuar'}
                            </Button>
                        )}
                        <Button 
                            onClick={() => handleGuardarModal('salir')}
                            disabled={guardando || !moduloEditando?.moduloId}
                            className="bg-marca hover:bg-marca-fuerte text-white"
                        >
                            {guardando ? 'Guardando...' : 'Guardar y salir'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
