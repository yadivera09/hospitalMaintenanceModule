'use client'

/**
 * src/components/admin/contratos/ContratoForm.tsx
 * Formulario de creación y edición de contratos.
 * Validación: fecha_fin debe ser >= fecha_inicio cuando está definida.
 * Sin conexión a Supabase — solo estructura (BLOQUE 1).
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
import { TIPOS_CONTRATO } from '@/mocks/contratos'
import type { Contrato, Cliente } from '@/types'

// =============================================================================
// SCHEMA
// =============================================================================

const contratoSchema = z.object({
    numero_contrato: z.string()
        .min(1, 'El código del contrato es obligatorio')
        .regex(/^\S+$/, 'El código no debe contener espacios'),
    cliente_id: z.string().min(1, 'Selecciona un cliente'),
    fecha_inicio: z.string().min(1, 'La fecha de inicio es obligatoria'),
    fecha_fin: z.string().optional().or(z.literal('')),
    tipo_contrato: z.string().min(1, 'Selecciona un tipo'),
    estado_display: z.enum(['activo', 'vencido', 'suspendido', 'cancelado']),
    observaciones: z.string().max(1000, 'Máximo 1000 caracteres').optional().or(z.literal('')),
}).superRefine((d, ctx) => {
    if (d.fecha_fin && d.fecha_inicio > d.fecha_fin) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'La fecha de fin debe ser igual o posterior a la fecha de inicio',
            path: ['fecha_fin'],
        })
    }
})

export type ContratoFormValues = z.infer<typeof contratoSchema>

// =============================================================================
// TIPOS
// =============================================================================

interface ContratoFormProps {
    modo: 'crear' | 'editar'
    contratoInicial?: Contrato
    clientesList: Cliente[]
    onGuardar: (valores: ContratoFormValues) => void
    onCancelar: () => void
    isLoading?: boolean
}

// =============================================================================
// HELPER — mapea Contrato → valores del form
// =============================================================================

function contratoAFormValues(c: Contrato): ContratoFormValues {
    return {
        numero_contrato: c.numero_contrato,
        cliente_id: c.cliente_id,
        fecha_inicio: c.fecha_inicio,
        fecha_fin: c.fecha_fin ?? '',
        tipo_contrato: c.tipo_contrato,
        estado_display: (c.estado_display ?? (c.activo ? 'activo' : 'cancelado')) as ContratoFormValues['estado_display'],
        observaciones: c.observaciones ?? '',
    }
}

// =============================================================================
// COMPONENTE
// =============================================================================

export default function ContratoForm({
    modo,
    contratoInicial,
    clientesList,
    onGuardar,
    onCancelar,
    isLoading = false,
}: ContratoFormProps) {
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors },
    } = useForm<ContratoFormValues>({
        resolver: zodResolver(contratoSchema),
        defaultValues:
            modo === 'editar' && contratoInicial
                ? contratoAFormValues(contratoInicial)
                : { estado_display: 'activo', tipo_contrato: 'anual' },
    })

    useEffect(() => {
        if (modo === 'editar' && contratoInicial) {
            reset(contratoAFormValues(contratoInicial))
        }
    }, [contratoInicial, modo, reset])

    const tipoActual = watch('tipo_contrato')
    const estadoActual = watch('estado_display')
    const clienteActual = watch('cliente_id')

    return (
        <form onSubmit={handleSubmit(onGuardar)} className="space-y-4" noValidate>

            {/* ── Código de contrato ───────────────────────── */}
            <div className="space-y-1.5">
                <Label htmlFor="numero_contrato" className="text-sm font-medium text-tinta-media">
                    Código de contrato <span className="text-critico-tinta">*</span>
                </Label>
                <Input
                    id="numero_contrato"
                    placeholder="Ej: CTR-2025-001"
                    {...register('numero_contrato', {
                        onChange: (e) => {
                            e.target.value = e.target.value.toUpperCase().replace(/\s/g, '')
                        }
                    })}
                    className={errors.numero_contrato ? 'border-critico-linea' : ''}
                />
                {errors.numero_contrato && (
                    <p className="text-xs text-critico-tinta">{errors.numero_contrato.message}</p>
                )}
            </div>

            {/* ── Cliente ──────────────────────────────────── */}
            <div className="space-y-1.5">
                <Label className="text-sm font-medium text-tinta-media">
                    Cliente <span className="text-critico-tinta">*</span>
                </Label>
                <Select
                    value={clienteActual}
                    onValueChange={(val) => setValue('cliente_id', val)}
                >
                    <SelectTrigger className={errors.cliente_id ? 'border-critico-linea' : ''}>
                        <SelectValue placeholder="Selecciona un cliente…" />
                    </SelectTrigger>
                    <SelectContent>
                        {clientesList.filter((c) => c.activo).map((cliente) => (
                            <SelectItem key={cliente.id} value={cliente.id}>
                                {cliente.razon_social}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {errors.cliente_id && (
                    <p className="text-xs text-critico-tinta">{errors.cliente_id.message}</p>
                )}
            </div>

            {/* ── Tipo + Estado (2 col) ────────────────────── */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-tinta-media">
                        Tipo <span className="text-critico-tinta">*</span>
                    </Label>
                    <Select
                        value={tipoActual}
                        onValueChange={(val) => setValue('tipo_contrato', val)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Tipo…" />
                        </SelectTrigger>
                        <SelectContent>
                            {TIPOS_CONTRATO.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                    {t.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-tinta-media">Estado</Label>
                    <Select
                        value={estadoActual}
                        onValueChange={(val) =>
                            setValue('estado_display', val as ContratoFormValues['estado_display'])
                        }
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Estado…" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="activo">Activo</SelectItem>
                            <SelectItem value="vencido">Vencido</SelectItem>
                            <SelectItem value="suspendido">Suspendido</SelectItem>
                            <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* ── Fecha inicio + Fecha fin (2 col) ─────────── */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="fecha_inicio" className="text-sm font-medium text-tinta-media">
                        Fecha inicio <span className="text-critico-tinta">*</span>
                    </Label>
                    <Input
                        id="fecha_inicio"
                        type="date"
                        {...register('fecha_inicio')}
                        className={errors.fecha_inicio ? 'border-critico-linea' : ''}
                    />
                    {errors.fecha_inicio && (
                        <p className="text-xs text-critico-tinta">{errors.fecha_inicio.message}</p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="fecha_fin" className="text-sm font-medium text-tinta-media">
                        Fecha fin
                    </Label>
                    <Input
                        id="fecha_fin"
                        type="date"
                        {...register('fecha_fin')}
                        className={errors.fecha_fin ? 'border-critico-linea' : ''}
                    />
                    {errors.fecha_fin && (
                        <p className="text-xs text-critico-tinta">{errors.fecha_fin.message}</p>
                    )}
                </div>
            </div>

            {/* ── Observaciones ────────────────────────────── */}
            <div className="space-y-1.5">
                <Label htmlFor="observaciones" className="text-sm font-medium text-tinta-media">
                    Observaciones
                </Label>
                <Textarea
                    id="observaciones"
                    placeholder="Notas adicionales sobre el contrato…"
                    rows={3}
                    {...register('observaciones')}
                    className="resize-none"
                />
            </div>

            {/* ── Acciones ────────────────────────────────── */}
            <div className="flex justify-end gap-2 pt-2 border-t border-borde">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancelar}
                    disabled={isLoading}
                    className="text-tinta-media"
                >
                    Cancelar
                </Button>
                <Button
                    type="submit"
                    disabled={isLoading}
                    className="bg-marca hover:bg-marca-fuerte text-white"
                >
                    {isLoading
                        ? 'Guardando…'
                        : modo === 'crear'
                            ? 'Guardar Contrato'
                            : 'Actualizar Contrato'}
                </Button>
            </div>
        </form>
    )
}
