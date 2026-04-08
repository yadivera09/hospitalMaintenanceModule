'use client'

/**
 * src/components/admin/clientes/ClienteForm.tsx
 * Formulario de creación y edición de clientes.
 * Validación con react-hook-form + zod.
 * Sin conexión a Supabase — solo estructura y validación (BLOQUE 1).
 * Compatible con modo: 'crear' | 'editar'.
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
import type { Cliente } from '@/types'

// =============================================================================
// SCHEMA DE VALIDACIÓN
// =============================================================================

const clienteSchema = z.object({
    razon_social: z
        .string()
        .min(3, 'El nombre debe tener al menos 3 caracteres')
        .max(200, 'Máximo 200 caracteres'),
    ruc: z
        .string()
        .regex(/^\d{13}$/, 'RUC debe tener exactamente 13 dígitos')
        .optional()
        .or(z.literal('')),
    email: z
        .string()
        .email('Email inválido')
        .optional()
        .or(z.literal('')),
    telefono: z
        .string()
        .max(30, 'Máximo 30 caracteres')
        .optional()
        .or(z.literal('')),
    direccion: z
        .string()
        .max(500, 'Máximo 500 caracteres')
        .optional()
        .or(z.literal('')),
    activo: z.enum(['true', 'false']),
})

export type ClienteFormValues = z.infer<typeof clienteSchema>

// =============================================================================
// TIPOS
// =============================================================================

interface ClienteFormProps {
    /** 'crear' muestra el botón "Guardar Cliente". 'editar' muestra "Actualizar". */
    modo: 'crear' | 'editar'
    /** Cliente existente — obligatorio cuando modo === 'editar' */
    clienteInicial?: Cliente
    /** Callback al guardar (recibe los valores del form) */
    onGuardar: (valores: ClienteFormValues) => void
    /** Callback al cancelar */
    onCancelar: () => void
    /** Indica si el formulario está en proceso de envío */
    isLoading?: boolean
}

// =============================================================================
// HELPER — mapea Cliente → valores del form
// =============================================================================

function clienteAFormValues(cliente: Cliente): ClienteFormValues {
    return {
        razon_social: cliente.razon_social,
        ruc: cliente.ruc ?? '',
        email: cliente.email ?? '',
        telefono: cliente.telefono ?? '',
        direccion: cliente.direccion ?? '',
        activo: cliente.activo ? 'true' : 'false',
    }
}

// =============================================================================
// COMPONENTE
// =============================================================================

export default function ClienteForm({
    modo,
    clienteInicial,
    onGuardar,
    onCancelar,
    isLoading = false,
}: ClienteFormProps) {
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors },
    } = useForm<ClienteFormValues>({
        resolver: zodResolver(clienteSchema),
        defaultValues:
            modo === 'editar' && clienteInicial
                ? clienteAFormValues(clienteInicial)
                : { activo: 'true' },
    })

    // Cuando el cliente inicial cambia (ej: abrir edición de otro cliente),
    // resetear el formulario con los nuevos datos.
    useEffect(() => {
        if (modo === 'editar' && clienteInicial) {
            reset(clienteAFormValues(clienteInicial))
        }
    }, [clienteInicial, modo, reset])

    const estadoActual = watch('activo')

    return (
        <form
            onSubmit={handleSubmit(onGuardar)}
            className="space-y-5"
            noValidate
        >
            {/* ── Razón social ─────────────────────────────── */}
            <div className="space-y-1.5">
                <Label htmlFor="razon_social" className="text-sm font-medium text-[#334155]">
                    Nombre / Razón social <span className="text-red-500">*</span>
                </Label>
                <Input
                    id="razon_social"
                    placeholder="Ej: Clínica San Lucas S.A."
                    {...register('razon_social')}
                    className={errors.razon_social ? 'border-red-400 focus-visible:ring-red-300' : ''}
                />
                {errors.razon_social && (
                    <p className="text-xs text-red-500">{errors.razon_social.message}</p>
                )}
            </div>

            {/* ── RUC ──────────────────────────────────────── */}
            <div className="space-y-1.5">
                <Label htmlFor="ruc" className="text-sm font-medium text-[#334155]">
                    RUC
                </Label>
                <Input
                    id="ruc"
                    placeholder="0991234567001"
                    maxLength={13}
                    {...register('ruc')}
                    className={errors.ruc ? 'border-red-400 focus-visible:ring-red-300' : ''}
                />
                {errors.ruc && (
                    <p className="text-xs text-red-500">{errors.ruc.message}</p>
                )}
            </div>

            {/* ── Email + Teléfono (2 columnas) ──────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-sm font-medium text-[#334155]">
                        Email
                    </Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="admin@clinica.com"
                        {...register('email')}
                        className={errors.email ? 'border-red-400 focus-visible:ring-red-300' : ''}
                    />
                    {errors.email && (
                        <p className="text-xs text-red-500">{errors.email.message}</p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="telefono" className="text-sm font-medium text-[#334155]">
                        Teléfono
                    </Label>
                    <Input
                        id="telefono"
                        placeholder="+593 4 234-5678"
                        {...register('telefono')}
                        className={errors.telefono ? 'border-red-400 focus-visible:ring-red-300' : ''}
                    />
                    {errors.telefono && (
                        <p className="text-xs text-red-500">{errors.telefono.message}</p>
                    )}
                </div>
            </div>

            {/* ── Dirección ────────────────────────────────── */}
            <div className="space-y-1.5">
                <Label htmlFor="direccion" className="text-sm font-medium text-[#334155]">
                    Dirección
                </Label>
                <Textarea
                    id="direccion"
                    placeholder="Av. 9 de Octubre 1234, Guayaquil"
                    rows={2}
                    {...register('direccion')}
                    className={`resize-none ${errors.direccion ? 'border-red-400 focus-visible:ring-red-300' : ''}`}
                />
                {errors.direccion && (
                    <p className="text-xs text-red-500">{errors.direccion.message}</p>
                )}
            </div>

            {/* ── Estado ───────────────────────────────────── */}
            <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#334155]">
                    Estado
                </Label>
                <Select
                    value={estadoActual}
                    onValueChange={(val) => setValue('activo', val as 'true' | 'false')}
                >
                    <SelectTrigger id="activo" className="w-40">
                        <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="true">Activo</SelectItem>
                        <SelectItem value="false">Inactivo</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* ── Acciones ────────────────────────────────── */}
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
                            ? 'Guardar Cliente'
                            : 'Actualizar Cliente'}
                </Button>
            </div>
        </form>
    )
}
