'use server'

/**
 * src/app/actions/seguridad/modulos.ts
 * Server Actions para gestión de menús y módulos del sistema RBAC.
 * Todas las operaciones de escritura requieren rol 'administrador'.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, ACCESO_DENEGADO } from '@/lib/seguridad/guard'
import { registrarAuditoria } from '@/lib/seguridad/auditoria'
import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

type ActionResult<T> = { data: T | null; error: string | null }

export interface Modulo {
    id: string
    menu_id: string
    nombre: string
    url: string
    descripcion: string | null
    icono: string
    orden: number
    activo: boolean
    created_at: string
    updated_at: string
}

export interface Menu {
    id: string
    nombre: string
    icono: string
    orden: number
    activo: boolean
    created_at: string
    updated_at: string
    modulos: Modulo[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

const MenuSchema = z.object({
    nombre: z.string().min(1, 'El nombre es obligatorio').max(100),
    icono: z.string().min(1, 'El ícono es obligatorio').default('bi bi-grid'),
    orden: z.number().int().min(0).default(0),
})

const ModuloSchema = z.object({
    menu_id: z.string().uuid('menu_id debe ser un UUID válido'),
    nombre: z.string().min(1, 'El nombre es obligatorio').max(100),
    url: z.string().min(1, 'La URL es obligatoria').max(200),
    descripcion: z.string().max(300).nullable().optional(),
    icono: z.string().default('bi bi-x-octagon'),
    orden: z.number().int().min(0).default(0),
})

// ─────────────────────────────────────────────────────────────────────────────
// getMenusConModulos — árbol completo menus → modulos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene el árbol completo de menús con sus módulos anidados.
 * Ordenados por campo 'orden'. Útil para renderizar la sidebar y la
 * pantalla de configuración de permisos por módulo.
 * Solo administradores.
 */
export async function getMenusConModulos(): Promise<ActionResult<Menu[]>> {
    const actor = await requireAdmin()
    if (!actor) return { data: null, error: ACCESO_DENEGADO }

    try {
        const admin = createAdminClient()
        const { data, error } = await admin
            .from('menus')
            .select(`
                id, nombre, icono, orden, activo, created_at, updated_at,
                modulos (
                    id, menu_id, nombre, url, descripcion, icono, orden, activo, created_at, updated_at
                )
            `)
            .order('orden', { ascending: true })

        if (error) throw error

        const menus: Menu[] = (data ?? []).map((menu) => ({
            id: menu.id,
            nombre: menu.nombre,
            icono: menu.icono,
            orden: menu.orden,
            activo: menu.activo,
            created_at: menu.created_at,
            updated_at: menu.updated_at,
            modulos: ((menu.modulos as Modulo[]) ?? []).sort((a, b) => a.orden - b.orden),
        }))

        return { data: menus, error: null }
    } catch (err) {
        console.error('[getMenusConModulos]', err)
        return { data: null, error: 'Error al cargar menús y módulos.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// crearMenu
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea un nuevo menú de navegación. Solo administradores.
 */
export async function crearMenu(raw: unknown): Promise<ActionResult<{ id: string; nombre: string }>> {
    const actor = await requireAdmin()
    if (!actor) return { data: null, error: ACCESO_DENEGADO }

    const parsed = MenuSchema.safeParse(raw)
    if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

    try {
        const admin = createAdminClient()
        const { data, error } = await admin
            .from('menus')
            .insert(parsed.data)
            .select('id, nombre')
            .single()

        if (error) {
            if (error.code === '23505') return { data: null, error: 'Ya existe un menú con ese nombre.' }
            throw error
        }

        await registrarAuditoria({
            usuario_id: actor.usuarioId || null,
            tabla: 'menus',
            registro_id: data.id,
            accion: 'ADICION',
            detalle: { datos: parsed.data },
        })

        return { data, error: null }
    } catch (err) {
        console.error('[crearMenu]', err)
        return { data: null, error: 'Error al crear el menú.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// editarMenu
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Edita un menú existente. Solo administradores.
 */
export async function editarMenu(
    id: string,
    raw: unknown
): Promise<ActionResult<{ id: string; nombre: string }>> {
    const actor = await requireAdmin()
    if (!actor) return { data: null, error: ACCESO_DENEGADO }

    const parsed = MenuSchema.partial().safeParse(raw)
    if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

    try {
        const admin = createAdminClient()
        const { data, error } = await admin
            .from('menus')
            .update(parsed.data)
            .eq('id', id)
            .select('id, nombre')
            .single()

        if (error) {
            if (error.code === '23505') return { data: null, error: 'Ya existe un menú con ese nombre.' }
            throw error
        }

        await registrarAuditoria({
            usuario_id: actor.usuarioId || null,
            tabla: 'menus',
            registro_id: id,
            accion: 'MODIFICACION',
            detalle: { cambios: parsed.data },
        })

        return { data, error: null }
    } catch (err) {
        console.error('[editarMenu]', err)
        return { data: null, error: 'Error al editar el menú.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// crearModulo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea un nuevo módulo (pantalla) dentro de un menú. Solo administradores.
 * La URL debe ser única en todo el sistema.
 */
export async function crearModulo(raw: unknown): Promise<ActionResult<{ id: string; nombre: string; url: string }>> {
    const actor = await requireAdmin()
    if (!actor) return { data: null, error: ACCESO_DENEGADO }

    const parsed = ModuloSchema.safeParse(raw)
    if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

    try {
        const admin = createAdminClient()
        const { data, error } = await admin
            .from('modulos')
            .insert({
                menu_id: parsed.data.menu_id,
                nombre: parsed.data.nombre,
                url: parsed.data.url,
                descripcion: parsed.data.descripcion ?? null,
                icono: parsed.data.icono,
                orden: parsed.data.orden,
            })
            .select('id, nombre, url')
            .single()

        if (error) {
            if (error.code === '23505') return { data: null, error: 'Ya existe un módulo con esa URL.' }
            throw error
        }

        await registrarAuditoria({
            usuario_id: actor.usuarioId || null,
            tabla: 'modulos',
            registro_id: data.id,
            accion: 'ADICION',
            detalle: { datos: parsed.data },
        })

        return { data, error: null }
    } catch (err) {
        console.error('[crearModulo]', err)
        return { data: null, error: 'Error al crear el módulo.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// editarModulo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Edita un módulo existente. Solo administradores.
 */
export async function editarModulo(
    id: string,
    raw: unknown
): Promise<ActionResult<{ id: string; nombre: string; url: string }>> {
    const actor = await requireAdmin()
    if (!actor) return { data: null, error: ACCESO_DENEGADO }

    const parsed = ModuloSchema.partial().safeParse(raw)
    if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

    try {
        const admin = createAdminClient()
        const { data, error } = await admin
            .from('modulos')
            .update({
                ...(parsed.data.menu_id ? { menu_id: parsed.data.menu_id } : {}),
                ...(parsed.data.nombre ? { nombre: parsed.data.nombre } : {}),
                ...(parsed.data.url ? { url: parsed.data.url } : {}),
                ...(parsed.data.descripcion !== undefined ? { descripcion: parsed.data.descripcion } : {}),
                ...(parsed.data.icono ? { icono: parsed.data.icono } : {}),
                ...(parsed.data.orden !== undefined ? { orden: parsed.data.orden } : {}),
            })
            .eq('id', id)
            .select('id, nombre, url')
            .single()

        if (error) {
            if (error.code === '23505') return { data: null, error: 'Ya existe un módulo con esa URL.' }
            throw error
        }

        await registrarAuditoria({
            usuario_id: actor.usuarioId || null,
            tabla: 'modulos',
            registro_id: id,
            accion: 'MODIFICACION',
            detalle: { cambios: parsed.data },
        })

        return { data, error: null }
    } catch (err) {
        console.error('[editarModulo]', err)
        return { data: null, error: 'Error al editar el módulo.' }
    }
}
