import ReporteDetalleResolver from './ReporteDetalleResolver'
import { getReporteById } from '@/app/actions/reportes'

/**
 * Detalle de un reporte del técnico.
 *
 * El servidor intenta resolverlo, pero NO decide: sin red la página se sirve
 * desde el cascarón cacheado, que pertenece a otro id, y renderizar aquí el
 * resultado mostraría un reporte equivocado con toda naturalidad. La última
 * palabra la tiene el cliente, que compara contra el id de la URL y recurre a
 * IndexedDB cuando hace falta.
 *
 * Por lo mismo un error del servidor no corta el render: se pasa hacia abajo
 * para enseñarlo solo si tampoco hay copia local.
 */
export default async function ReporteDetallePage({ params }: { params: { id: string } }) {
    const res = await getReporteById(params.id).catch(() => ({ data: null, error: null }))

    return (
        <ReporteDetalleResolver
            inicial={res.data ?? null}
            errorServidor={res.error ?? null}
        />
    )
}
