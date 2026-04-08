/**
 * src/app/(admin)/admin/equipos/page.tsx
 * Server Component — carga equipos desde Supabase vía v_equipo_contrato_vigente.
 * BLOQUE 3 — añade categorías y tipos de mantenimiento para el form.
 */
import { createClient } from '@/lib/supabase/server'
import { getEquipos } from '@/app/actions/equipos'
import { getCategorias } from '@/app/actions/catalogos'
import EquiposPageClient from './EquiposPageClient'

export const metadata = { title: 'Equipos — Mobilhospital' }
export const dynamic = 'force-dynamic'

export default async function EquiposPage() {
    const supabase = createClient()
    const [{ data: equipos, error }, { data: categorias }, { data: tipos }, { data: contratosRaw }] = await Promise.all([
        getEquipos(),
        getCategorias(),
        supabase.from('tipos_mantenimiento').select('id, nombre').order('nombre'),
        supabase
            .from('contratos')
            .select('id, numero_contrato, cliente_id, activo, clientes(razon_social)')
            .order('numero_contrato'),
    ])

    // Aplanar el join de clientes para el component
    const contratos = (contratosRaw ?? []).map((c: any) => ({
        id: c.id,
        numero_contrato: c.numero_contrato,
        cliente_id: c.cliente_id,
        activo: c.activo,
        cliente_nombre: c.clientes?.razon_social ?? undefined,
    }))

    return (
        <EquiposPageClient
            equiposIniciales={equipos ?? []}
            categoriasList={categorias ?? []}
            tiposMantenimiento={tipos ?? []}
            contratos={contratos}
            errorInicial={error}
        />
    )
}
