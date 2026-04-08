/**
 * src/app/(admin)/admin/catalogos/page.tsx
 * Server Component — Carga en paralelo las 4 listas de catálogos + tipos de mantenimiento.
 * BLOQUE 2 — Conectado a Supabase real.
 */
import { getCategorias, getInsumos, getUbicaciones } from '@/app/actions/catalogos'
import { getClientes } from '@/app/actions/clientes'
import { createAdminClient } from '@/lib/supabase/admin'
import CatalogosClient from './CatalogosClient'

export const metadata = {
    title: 'Catálogos — Mobilhospital',
}

export default async function CatalogosPage() {
    const [
        { data: categorias },
        { data: insumos },
        { data: ubicaciones },
        { data: clientes },
        tiposRes,
    ] = await Promise.all([
        getCategorias(),
        getInsumos(),
        getUbicaciones(),
        getClientes(),
        createAdminClient()
            .from('tipos_mantenimiento')
            .select('id, nombre, periodicidad_dias, activo')
            .order('nombre'),
    ])

    const tipos = (tiposRes.data ?? []) as { id: string; nombre: string; periodicidad_dias: number; activo: boolean }[]

    return (
        <CatalogosClient
            categoriasIniciales={categorias ?? []}
            insumosIniciales={insumos ?? []}
            ubicacionesIniciales={ubicaciones ?? []}
            clientesList={clientes ?? []}
            tiposIniciales={tipos}
        />
    )
}

