'use client'

/**
 * src/components/admin/equipos/EquipoForm.tsx
 * Formulario de creación y edición de equipos.
 * BLOQUE 3 — Conectado a datos reales. Se eliminan mocks.
 * tipo_mantenimiento_id es requerido (NOT NULL en BD).
 */

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import type { Equipo } from '@/types'

// =============================================================================
// SCHEMA
// =============================================================================

const equipoSchema = z.object({
    codigo_mh: z
        .string()
        .min(3, 'Mínimo 3 caracteres')
        .max(50, 'Máximo 50 caracteres')
        .regex(/^MH-/, 'El código debe comenzar con "MH-"'),
    numero_serie: z
        .string()
        .max(100, 'Máximo 100 caracteres')
        .optional()
        .or(z.literal('')),
    activo_fijo: z
        .string()
        .max(100, 'Máximo 100 caracteres')
        .optional()
        .or(z.literal('')),
    nombre: z.string().min(3, 'Mínimo 3 caracteres').max(200, 'Máximo 200 caracteres'),
    marca: z.string().max(100).optional().or(z.literal('')),
    modelo: z.string().max(100).optional().or(z.literal('')),
    categoria_id: z.string().min(1, 'Selecciona una categoría'),
    tipo_mantenimiento_id: z.string().min(1, 'Selecciona un tipo de mantenimiento'),
    fecha_fabricacion: z.string().optional().or(z.literal('')),
    estado_display: z.enum(['activo', 'almacenado', 'baja']),
    observaciones: z.string().max(1000).optional().or(z.literal('')),
})

export type EquipoFormValues = z.infer<typeof equipoSchema>

// =============================================================================
// TIPOS
// =============================================================================

interface Categoria {
    id: string
    nombre: string
}

interface TipoMantenimiento {
    id: string
    nombre: string
}

interface EquipoFormProps {
    modo: 'crear' | 'editar'
    equipoInicial?: Equipo
    categorias: Categoria[]
    tiposMantenimiento: TipoMantenimiento[]
    onGuardar: (valores: EquipoFormValues) => void
    onCancelar: () => void
    isLoading?: boolean
}

// =============================================================================
// HELPER — mapea Equipo → valores del form
// =============================================================================

function equipoAFormValues(e: Equipo): EquipoFormValues {
    return {
        codigo_mh: e.codigo_mh,
        numero_serie: e.numero_serie ?? '',
        activo_fijo: e.activo_fijo ?? '',
        nombre: e.nombre,
        marca: e.marca ?? '',
        modelo: e.modelo ?? '',
        categoria_id: e.categoria_id,
        tipo_mantenimiento_id: (e as any).tipo_mantenimiento_id ?? '',
        fecha_fabricacion: e.fecha_fabricacion ?? '',
        estado_display: (e.estado_display ?? (e.activo ? 'activo' : 'baja')) as EquipoFormValues['estado_display'],
        observaciones: e.observaciones ?? '',
    }
}

// =============================================================================
// COMPONENTE
// =============================================================================

export default function EquipoForm({
    modo,
    equipoInicial,
    categorias,
    tiposMantenimiento,
    onGuardar,
    onCancelar,
    isLoading = false,
}: EquipoFormProps) {
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors },
    } = useForm<EquipoFormValues>({
        resolver: zodResolver(equipoSchema),
        defaultValues:
            modo === 'editar' && equipoInicial
                ? equipoAFormValues(equipoInicial)
                : { estado_display: 'activo' },
    })

    useEffect(() => {
        if (modo === 'editar' && equipoInicial) {
            reset(equipoAFormValues(equipoInicial))
        }
    }, [equipoInicial, modo, reset])

    const categoriaActual = watch('categoria_id')
    const tipoActual = watch('tipo_mantenimiento_id')
    const estadoActual = watch('estado_display')

    return (
        <form onSubmit={handleSubmit(onGuardar)} className="space-y-4" noValidate>

            {/* ── Identificadores (3 columnas en md) ─────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="codigo_mh" className="text-sm font-medium text-[#334155]">
                        Código MH <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        id="codigo_mh"
                        placeholder="MH-CAM-0001"
                        {...register('codigo_mh')}
                        className={`font-mono ${errors.codigo_mh ? 'border-red-400' : ''}`}
                        disabled={modo === 'editar'}
                    />
                    {errors.codigo_mh && (
                        <p className="text-xs text-red-500">{errors.codigo_mh.message}</p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="numero_serie" className="text-sm font-medium text-[#334155]">
                        N° Serie
                    </Label>
                    <Input
                        id="numero_serie"
                        placeholder="SN-XXX-2024"
                        {...register('numero_serie')}
                        className={`font-mono ${errors.numero_serie ? 'border-red-400' : ''}`}
                    />
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="activo_fijo" className="text-sm font-medium text-[#334155]">
                        Activo fijo
                    </Label>
                    <Input
                        id="activo_fijo"
                        placeholder="AF-001-2024"
                        {...register('activo_fijo')}
                        className="font-mono"
                    />
                </div>
            </div>

            {/* ── Nombre ──────────────────────────────────────────── */}
            <div className="space-y-1.5">
                <Label htmlFor="nombre" className="text-sm font-medium text-[#334155]">
                    Nombre del equipo <span className="text-red-500">*</span>
                </Label>
                <Input
                    id="nombre"
                    placeholder="Ej: Cama hospitalaria eléctrica"
                    {...register('nombre')}
                    className={errors.nombre ? 'border-red-400' : ''}
                />
                {errors.nombre && (
                    <p className="text-xs text-red-500">{errors.nombre.message}</p>
                )}
            </div>

            {/* ── Marca + Modelo ───────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="marca" className="text-sm font-medium text-[#334155]">Marca</Label>
                    <Input id="marca" placeholder="Hill-Rom" {...register('marca')} />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="modelo" className="text-sm font-medium text-[#334155]">Modelo</Label>
                    <Input id="modelo" placeholder="Progressa" {...register('modelo')} />
                </div>
            </div>

            {/* ── Categoría + Tipo Mantenimiento ───────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-[#334155]">
                        Categoría <span className="text-red-500">*</span>
                    </Label>
                    <Select value={categoriaActual} onValueChange={(val) => setValue('categoria_id', val)}>
                        <SelectTrigger className={errors.categoria_id ? 'border-red-400' : ''}>
                            <SelectValue placeholder="Categoría…" />
                        </SelectTrigger>
                        <SelectContent>
                            {categorias.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                    {cat.nombre}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {errors.categoria_id && (
                        <p className="text-xs text-red-500">{errors.categoria_id.message}</p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-[#334155]">
                        Tipo de mantenimiento <span className="text-red-500">*</span>
                    </Label>
                    <Select value={tipoActual} onValueChange={(val) => setValue('tipo_mantenimiento_id', val)}>
                        <SelectTrigger className={errors.tipo_mantenimiento_id ? 'border-red-400' : ''}>
                            <SelectValue placeholder="Tipo…" />
                        </SelectTrigger>
                        <SelectContent>
                            {tiposMantenimiento.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                    {t.nombre}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {errors.tipo_mantenimiento_id && (
                        <p className="text-xs text-red-500">{errors.tipo_mantenimiento_id.message}</p>
                    )}
                </div>
            </div>

            {/* ── Estado + Fecha fabricación ───────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-[#334155]">Estado</Label>
                    <Select
                        value={estadoActual}
                        onValueChange={(val) =>
                            setValue('estado_display', val as EquipoFormValues['estado_display'])
                        }
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Estado…" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="activo">Activo</SelectItem>
                            <SelectItem value="almacenado">Almacenado</SelectItem>
                            <SelectItem value="baja">Baja</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="fecha_fabricacion" className="text-sm font-medium text-[#334155]">
                        Fecha fabricación
                    </Label>
                    <Input
                        id="fecha_fabricacion"
                        type="date"
                        {...register('fecha_fabricacion')}
                    />
                </div>
            </div>

            {/* ── Observaciones ────────────────────────────────────── */}
            <div className="space-y-1.5">
                <Label htmlFor="observaciones" className="text-sm font-medium text-[#334155]">
                    Observaciones
                </Label>
                <Textarea
                    id="observaciones"
                    placeholder="Notas adicionales sobre el equipo…"
                    rows={2}
                    {...register('observaciones')}
                    className="resize-none"
                />
            </div>

            {/* ── Acciones ─────────────────────────────────────────── */}
            <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancelar}
                    disabled={isLoading}
                    className="text-[#334155]"
                >
                    Cancelar
                </Button>
                <Button
                    type="submit"
                    disabled={isLoading}
                    className="bg-[#1E40AF] hover:bg-[#1E3A8A] text-white"
                >
                    {isLoading
                        ? 'Guardando…'
                        : modo === 'crear'
                            ? 'Guardar Equipo'
                            : 'Actualizar Equipo'}
                </Button>
            </div>
        </form>
    )
}
