import { getTecnicoById } from '@/app/actions/tecnicos'
import TecnicoDetalleClient from './TecnicoDetalleClient'

export const metadata = { title: 'Detalle de Técnico — Mobilhospital' }

export default async function TecnicoDetallePage({ params }: { params: { id: string } }) {
    const { data: tecnico, error } = await getTecnicoById(params.id)

    return (
        <TecnicoDetalleClient
            tecnicoInicial={tecnico as any}
            errorInicial={error}
        />
    )
}
