/**
 * src/app/(admin)/admin/tecnicos/page.tsx
 * Server Component — carga técnicos desde Supabase.
 */
import { getTecnicos } from '@/app/actions/tecnicos'
import TecnicosPageClient from './TecnicosPageClient'

export const metadata = { title: 'Técnicos — Mobilhospital' }

export default async function TecnicosPage() {
    const { data: tecnicos, error } = await getTecnicos()
    return <TecnicosPageClient tecnicosIniciales={tecnicos ?? []} errorInicial={error} />
}
