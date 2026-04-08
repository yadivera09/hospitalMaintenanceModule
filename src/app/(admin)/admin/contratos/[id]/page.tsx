import { getContratoById } from '@/app/actions/contratos'
import { getClientes } from '@/app/actions/clientes'
import ContratoDetalleClient from './ContratoDetalleClient'
import { Metadata } from 'next'

// Definimos la interface para los params basados en Next.js 14
interface PageProps {
    params: {
        id: string
    }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    return {
        title: `Detalle de Contrato — Mobilhospital`,
    }
}

export default async function ContratoDetallePage({ params }: PageProps) {
    const [{ data: contrato }, { data: clientes }] = await Promise.all([
        getContratoById(params.id),
        getClientes({ activo: true })
    ])

    return (
        <ContratoDetalleClient
            contratoInicial={contrato}
            clientesList={clientes ?? []}
        />
    )
}
