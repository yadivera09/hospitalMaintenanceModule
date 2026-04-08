'use client'

/**
 * src/components/admin/tecnicos/TecnicoForm.tsx
 * Formulario de creación y edición de técnicos.
 * Validación: cédula solo dígitos, mínimo 10.
 */

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import type { Tecnico } from '@/types'

// =============================================================================
// SCHEMA
// =============================================================================

const tecnicoSchema = z.object({
    nombre: z.string().min(2, 'Mínimo 2 caracteres').max(100),
    apellido: z.string().min(2, 'Mínimo 2 caracteres').max(100),
    cedula: z
        .string()
        .regex(/^\d+$/, 'Solo se permiten dígitos')
        .min(10, 'Mínimo 10 dígitos')
        .max(13, 'Máximo 13 dígitos'),
    email: z.string().email('Email inválido'),
    telefono: z.string().optional().or(z.literal('')),
    estado_display: z.enum(['activo', 'inactivo', 'suspendido']),
})

export type TecnicoFormValues = z.infer<typeof tecnicoSchema>

// =============================================================================
// TIPOS
// =============================================================================

interface TecnicoFormProps {
    modo: 'crear' | 'editar'
    tecnicoInicial?: Tecnico
    onGuardar: (valores: TecnicoFormValues) => void
    onCancelar: () => void
    isLoading?: boolean
}

function tecnicoAFormValues(t: Tecnico): TecnicoFormValues {
    return {
        nombre: t.nombre,
        apellido: t.apellido,
        cedula: t.cedula ?? '',
        email: t.email,
        telefono: t.telefono ?? '',
        estado_display: (t.estado_display ?? (t.activo ? 'activo' : 'inactivo')) as TecnicoFormValues['estado_display'],
    }
}

// =============================================================================
// COMPONENTE
// =============================================================================

export default function TecnicoForm({
    modo,
    tecnicoInicial,
    onGuardar,
    onCancelar,
    isLoading = false,
}: TecnicoFormProps) {
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors },
    } = useForm<TecnicoFormValues>({
        resolver: zodResolver(tecnicoSchema),
        defaultValues:
            modo === 'editar' && tecnicoInicial
                ? tecnicoAFormValues(tecnicoInicial)
                : { estado_display: 'activo' },
    })

    useEffect(() => {
        if (modo === 'editar' && tecnicoInicial) reset(tecnicoAFormValues(tecnicoInicial))
    }, [tecnicoInicial, modo, reset])

    const estadoActual = watch('estado_display')

    return (
        <form onSubmit={handleSubmit(onGuardar)} className="space-y-4" noValidate>

            {/* Nombre + Apellido */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="nombre" className="text-sm font-medium text-[#334155]">
                        Nombre <span className="text-red-500">*</span>
                    </Label>
                    <Input id="nombre" placeholder="Marcos" {...register('nombre')}
                        className={errors.nombre ? 'border-red-400' : ''} />
                    {errors.nombre && <p className="text-xs text-red-500">{errors.nombre.message}</p>}
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="apellido" className="text-sm font-medium text-[#334155]">
                        Apellido <span className="text-red-500">*</span>
                    </Label>
                    <Input id="apellido" placeholder="Rodríguez" {...register('apellido')}
                        className={errors.apellido ? 'border-red-400' : ''} />
                    {errors.apellido && <p className="text-xs text-red-500">{errors.apellido.message}</p>}
                </div>
            </div>

            {/* Cédula + Estado */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="cedula" className="text-sm font-medium text-[#334155]">
                        Cédula <span className="text-red-500">*</span>
                    </Label>
                    <Input id="cedula" placeholder="0912345678" {...register('cedula')}
                        className={`font-mono ${errors.cedula ? 'border-red-400' : ''}`} />
                    {errors.cedula && <p className="text-xs text-red-500">{errors.cedula.message}</p>}
                </div>
                <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-[#334155]">Estado</Label>
                    <Select value={estadoActual}
                        onValueChange={(v) => setValue('estado_display', v as TecnicoFormValues['estado_display'])}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="activo">Activo</SelectItem>
                            <SelectItem value="suspendido">Suspendido</SelectItem>
                            <SelectItem value="inactivo">Inactivo</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-[#334155]">
                    Email <span className="text-red-500">*</span>
                </Label>
                <Input id="email" type="email" placeholder="tecnico@mobilhospital.com"
                    {...register('email')} className={errors.email ? 'border-red-400' : ''} />
                {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>

            {/* Teléfono */}
            <div className="space-y-1.5">
                <Label htmlFor="telefono" className="text-sm font-medium text-[#334155]">Teléfono</Label>
                <Input id="telefono" placeholder="+593 99 000-0000" {...register('telefono')} />
            </div>

            {/* Acciones */}
            <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
                <Button type="button" variant="outline" onClick={onCancelar} disabled={isLoading} className="text-[#334155]">
                    Cancelar
                </Button>
                <Button type="submit" disabled={isLoading} className="bg-[#1E40AF] hover:bg-[#1E3A8A] text-white">
                    {isLoading ? 'Guardando…' : modo === 'crear' ? 'Guardar Técnico' : 'Actualizar Técnico'}
                </Button>
            </div>
        </form>
    )
}
