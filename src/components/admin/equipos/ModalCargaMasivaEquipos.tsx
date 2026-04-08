'use client'

import { useState, useRef } from 'react'
import { Upload, FileDown, AlertCircle, CheckCircle2, XCircle, Info, Table, AlertTriangle, ToggleLeft, ToggleRight } from 'lucide-react'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { importarEquiposDesdeCSV } from '@/app/actions/equipos'

interface ContratoRef {
    id: string
    numero_contrato: string
    cliente_id: string
    activo: boolean
    cliente_nombre?: string
}

interface ModalCargaMasivaEquiposProps {
    onSuccess: () => void
    onCancel: () => void
    categorias: { id: string, nombre: string }[]
    tiposMantenimiento: { id: string, nombre: string }[]
    contratos: ContratoRef[]
}

type Step = 'upload' | 'preview' | 'result'

export default function ModalCargaMasivaEquipos({
    onSuccess,
    onCancel,
    categorias,
    tiposMantenimiento,
    contratos,
}: ModalCargaMasivaEquiposProps) {
    const [step, setStep] = useState<Step>('upload')
    const [data, setData] = useState<any[]>([])
    const [errorsInFile, setErrorsInFile] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<{ insertados: number, fallidos: number, detalles: any[] } | null>(null)
    const [modo, setModo] = useState<'insert' | 'upsert'>('insert')
    const fileInputRef = useRef<HTMLInputElement>(null)

    const contratosActivos = contratos.filter((c) => c.activo)

    const downloadTemplate = () => {
        const headers = 'codigo_mh,nombre,marca,modelo,numero_serie,activo_fijo,categoria,tipo_mantenimiento,numero_contrato,cliente,ubicacion,fecha_fabricacion,observaciones\n'
        const cat = categorias[0]?.nombre || 'Cama hospitalaria'
        const tipo = tiposMantenimiento[0]?.nombre || 'Preventivo'
        const contrato = contratosActivos[0]?.numero_contrato || 'CONT-000001'
        const example = `MH-000001,Cama Eléctrica Hospitalaria,Hillrom,Advanta 2,SN123456,AF-001,${cat},${tipo},${contrato},,UCI,2023-01-01,Revision inicial`
        const blob = new Blob([headers + example], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'plantilla_equipos_mobilhospital.csv'
        a.click()
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const csvText = event.target?.result as string
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                delimiter: ',',
                complete: (results) => {
                    const rows = results.data as any[]
                    const errors: string[] = []

                    if (rows.length === 0) {
                        errors.push('El archivo está vacío')
                    } else {
                        const firstRow = rows[0]
                        // Columnas obligatorias
                        const required = [
                            'codigo_mh',
                            'nombre',
                            'categoria',
                            'tipo_mantenimiento',
                            'numero_contrato',
                        ]
                        required.forEach((h) => {
                            if (!(h in firstRow)) errors.push(`Falta la columna obligatoria: ${h}`)
                        })
                    }

                    if (errors.length > 0) {
                        setErrorsInFile(errors)
                    } else {
                        setData(rows)
                        setStep('preview')
                        setErrorsInFile([])
                    }
                },
            })
        }
        reader.readAsText(file, 'ISO-8859-1')
    }

    const handleImport = async () => {
        setLoading(true)
        try {
            const res = await importarEquiposDesdeCSV(data, modo)
            setResult(res)
            setStep('result')
        } catch (err) {
            console.error(err)
            setErrorsInFile(['Error al procesar la carga en el servidor'])
        } finally {
            setLoading(false)
        }
    }

    return (
        <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-2">
                <DialogTitle className="flex items-center gap-2 text-xl">
                    <Table className="h-5 w-5 text-[#1E40AF]" />
                    Carga Masiva de Equipos
                </DialogTitle>
                <DialogDescription>
                    Sube un CSV para registrar equipos y asignarlos automáticamente a un contrato.
                </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-2">
                {step === 'upload' && (
                    <div className="space-y-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Instrucciones */}
                            <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 space-y-3">
                                <h3 className="text-sm font-bold text-[#1E40AF] flex items-center gap-2">
                                    <Info className="h-4 w-4" /> Instrucciones
                                </h3>
                                <ul className="text-xs text-[#475569] space-y-2 list-disc pl-4">
                                    <li>Descarga la plantilla para ver el formato correcto.</li>
                                    <li>
                                        Columnas <strong>obligatorias</strong>:{' '}
                                        <code className="bg-blue-100 px-1 rounded text-[10px]">codigo_mh</code>,{' '}
                                        <code className="bg-blue-100 px-1 rounded text-[10px]">nombre</code>,{' '}
                                        <code className="bg-blue-100 px-1 rounded text-[10px]">categoria</code>,{' '}
                                        <code className="bg-blue-100 px-1 rounded text-[10px]">tipo_mantenimiento</code>,{' '}
                                        <code className="bg-red-100 px-1 rounded text-[10px]">numero_contrato</code>
                                    </li>
                                    <li>
                                        Columnas <strong>opcionales</strong>: marca, modelo, numero_serie, activo_fijo,
                                        cliente, ubicacion, fecha_fabricacion, observaciones.
                                    </li>
                                    <li>
                                        Si <code className="bg-slate-100 px-1 rounded text-[10px]">ubicacion</code> se
                                        especifica, debe pertenecer al cliente del contrato.
                                    </li>
                                    <li>El Código MH debe comenzar con &quot;MH-&quot; y ser único.</li>
                                </ul>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={downloadTemplate}
                                    className="w-full mt-2 bg-white text-[#1E40AF] border-blue-200"
                                >
                                    <FileDown className="h-4 w-4 mr-2" />
                                    Descargar Plantilla
                                </Button>
                            </div>

                            {/* Panel de referencia */}
                            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                                <h3 className="text-sm font-bold text-[#0F172A]">Valores de Referencia</h3>
                                <p className="text-[10px] text-[#94A3B8]">Escribe estos nombres exactamente en el CSV</p>
                                <div className="max-h-48 overflow-y-auto border rounded bg-slate-50 p-2 space-y-3">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold uppercase text-[#64748B]">Categorías</p>
                                        <div className="flex flex-wrap gap-1">
                                            {categorias.map((c) => (
                                                <Badge key={c.id} variant="outline" className="text-[9px] bg-white border-slate-200">
                                                    {c.nombre}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-1 pt-2 border-t">
                                        <p className="text-[10px] font-bold uppercase text-[#64748B]">Tipos Mant.</p>
                                        <div className="flex flex-wrap gap-1">
                                            {tiposMantenimiento.map((t) => (
                                                <Badge key={t.id} variant="outline" className="text-[9px] bg-white border-slate-200">
                                                    {t.nombre}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-1 pt-2 border-t">
                                        <p className="text-[10px] font-bold uppercase text-[#64748B] flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                                            Contratos Activos (numero_contrato)
                                        </p>
                                        {contratosActivos.length === 0 ? (
                                            <p className="text-[10px] text-red-500 font-medium">
                                                ⚠ No hay contratos activos. La carga masiva fallará para todas las filas.
                                            </p>
                                        ) : (
                                            <div className="flex flex-wrap gap-1">
                                                {contratosActivos.map((c) => (
                                                    <Badge
                                                        key={c.id}
                                                        variant="outline"
                                                        className="text-[9px] bg-white border-green-200 text-green-700 font-mono"
                                                    >
                                                        {c.numero_contrato}
                                                        {c.cliente_nombre && (
                                                            <span className="ml-1 text-[#94A3B8] font-sans">
                                                                · {c.cliente_nombre}
                                                            </span>
                                                        )}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modo de importación */}
                        <div className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
                            <p className="text-xs font-semibold text-[#334155]">Modo de importación:</p>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setModo('insert')}
                                    className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-md transition-all ${modo === 'insert'
                                            ? 'bg-[#1E40AF] text-white shadow-sm'
                                            : 'bg-white border border-slate-200 text-[#64748B] hover:bg-slate-100'
                                        }`}
                                >
                                    {modo === 'insert' ? (
                                        <ToggleRight className="h-3.5 w-3.5" />
                                    ) : (
                                        <ToggleLeft className="h-3.5 w-3.5" />
                                    )}
                                    Insertar
                                </button>
                                <button
                                    onClick={() => setModo('upsert')}
                                    className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-md transition-all ${modo === 'upsert'
                                            ? 'bg-amber-600 text-white shadow-sm'
                                            : 'bg-white border border-slate-200 text-[#64748B] hover:bg-slate-100'
                                        }`}
                                >
                                    {modo === 'upsert' ? (
                                        <ToggleRight className="h-3.5 w-3.5" />
                                    ) : (
                                        <ToggleLeft className="h-3.5 w-3.5" />
                                    )}
                                    Actualizar si existe
                                </button>
                            </div>
                            <p className="text-[10px] text-[#94A3B8] flex-1">
                                {modo === 'insert'
                                    ? 'Falla si el Código MH ya existe.'
                                    : 'Si el Código MH ya existe, actualiza datos y reasigna contrato.'}
                            </p>
                        </div>

                        {/* Zona de drop */}
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-[#E2E8F0] rounded-2xl p-12 text-center hover:border-[#1E40AF] hover:bg-blue-50/30 transition-all cursor-pointer group"
                        >
                            <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                            <div className="h-14 w-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:bg-[#1E40AF]/10 transition-all">
                                <Upload className="h-6 w-6 text-[#94A3B8] group-hover:text-[#1E40AF]" />
                            </div>
                            <p className="text-sm font-bold text-[#0F172A]">Selecciona o arrastra tu archivo CSV</p>
                            <p className="text-xs text-[#94A3B8] mt-1">Solo archivos .csv con el formato de la plantilla</p>
                        </div>

                        {errorsInFile.length > 0 && (
                            <Alert variant="destructive" className="rounded-xl">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Errores detectados en el archivo</AlertTitle>
                                <AlertDescription>
                                    <ul className="list-disc pl-4 mt-1">
                                        {errorsInFile.map((err, i) => <li key={i}>{err}</li>)}
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                )}

                {step === 'preview' && (
                    <div className="space-y-4 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <h3 className="text-sm font-bold text-[#0F172A]">Previsualización ({data.length} filas)</h3>
                                <Badge
                                    variant="outline"
                                    className={`text-[10px] ${modo === 'upsert'
                                            ? 'border-amber-300 bg-amber-50 text-amber-700'
                                            : 'border-blue-200 bg-blue-50 text-blue-700'
                                        }`}
                                >
                                    Modo: {modo === 'upsert' ? 'Actualizar si existe' : 'Insertar'}
                                </Badge>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setData([]); setStep('upload') }}
                                className="text-xs"
                            >
                                Cambiar archivo
                            </Button>
                        </div>
                        <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="max-h-96 overflow-auto">
                                <table className="w-full text-[10px] text-left">
                                    <thead className="sticky top-0 bg-[#F8FAFC] border-b text-[#64748B] uppercase font-bold">
                                        <tr>
                                            <th className="px-3 py-2 border-r">N°</th>
                                            <th className="px-3 py-2 border-r">Código MH</th>
                                            <th className="px-3 py-2 border-r">Nombre</th>
                                            <th className="px-3 py-2 border-r">Categoría</th>
                                            <th className="px-3 py-2 border-r">Tipo Mant.</th>
                                            <th className="px-3 py-2 border-r text-red-600">Contrato ✱</th>
                                            <th className="px-3 py-2">Ubicación</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {data.slice(0, 100).map((row, i) => (
                                            <tr key={i} className={`hover:bg-slate-50 transition-colors ${!row.numero_contrato ? 'bg-red-50' : ''}`}>
                                                <td className="px-3 py-2 border-r text-[#94A3B8]">{i + 1}</td>
                                                <td className="px-3 py-2 border-r font-mono font-bold text-[#1E40AF]">{row.codigo_mh}</td>
                                                <td className="px-3 py-2 border-r font-medium text-[#0F172A]">{row.nombre}</td>
                                                <td className="px-3 py-2 border-r text-[#334155]">{row.categoria}</td>
                                                <td className="px-3 py-2 border-r text-[#64748B]">{row.tipo_mantenimiento}</td>
                                                <td className={`px-3 py-2 border-r font-mono ${row.numero_contrato ? 'text-green-700 font-bold' : 'text-red-500 italic'}`}>
                                                    {row.numero_contrato || '⚠ faltante'}
                                                </td>
                                                <td className="px-3 py-2 text-[#94A3B8]">{row.ubicacion || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {data.length > 100 && (
                                <div className="p-2 bg-[#F8FAFC] text-center text-[10px] text-[#94A3B8] italic border-t">
                                    Mostrando solo las primeras 100 filas
                                </div>
                            )}
                        </div>
                        {data.some((r) => !r.numero_contrato) && (
                            <Alert variant="destructive" className="rounded-xl">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Filas sin contrato detectadas</AlertTitle>
                                <AlertDescription className="text-[11px]">
                                    Algunas filas no tienen <code>numero_contrato</code>. Estas filas fallarán en la
                                    importación. Corrige el CSV antes de continuar.
                                </AlertDescription>
                            </Alert>
                        )}
                        <Alert className="bg-amber-50 border-amber-200 text-amber-800 rounded-xl">
                            <Info className="h-4 w-4" />
                            <AlertDescription className="text-[11px]">
                                Cada equipo se insertará y asignará al contrato en una sola transacción. Si cualquier
                                paso falla, se hace rollback completo de esa fila — no quedarán equipos sin contrato.
                            </AlertDescription>
                        </Alert>
                    </div>
                )}

                {step === 'result' && result && (
                    <div className="space-y-6 py-6">
                        <div className="text-center space-y-2">
                            {result.fallidos === 0 ? (
                                <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                                </div>
                            ) : (
                                <div className="h-16 w-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <AlertTriangle className="h-8 w-8 text-amber-600" />
                                </div>
                            )}
                            <h2 className="text-xl font-bold text-[#0F172A]">Importación Finalizada</h2>
                            <div className="flex items-center justify-center gap-4 mt-4">
                                <div className="bg-green-50 px-4 py-2 rounded-lg border border-green-100">
                                    <p className="text-[10px] text-green-600 font-bold uppercase">Insertados</p>
                                    <p className="text-2xl font-bold text-green-700">{result.insertados}</p>
                                </div>
                                <div className="bg-red-50 px-4 py-2 rounded-lg border border-red-100">
                                    <p className="text-[10px] text-red-600 font-bold uppercase">Fallidos</p>
                                    <p className="text-2xl font-bold text-red-700">{result.fallidos}</p>
                                </div>
                            </div>
                        </div>

                        {result.detalles.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Detalle de Errores</h3>
                                <div className="rounded-xl border border-red-100 bg-red-50/30 overflow-hidden max-h-60 overflow-y-auto">
                                    <table className="w-full text-xs">
                                        <thead className="bg-red-50 text-red-700 font-bold text-[10px]">
                                            <tr>
                                                <th className="px-3 py-2">Fila</th>
                                                <th className="px-3 py-2">Código MH</th>
                                                <th className="px-3 py-2 text-right">Error</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-red-100">
                                            {result.detalles.map((det, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-3 py-2 font-mono text-[#94A3B8]">{det.row}</td>
                                                    <td className="px-3 py-2 font-bold">{det.codigo_mh || '—'}</td>
                                                    <td className="px-3 py-2 text-right text-red-600 font-medium">{det.error}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="p-6 bg-[#F8FAFC] border-t flex items-center justify-between gap-3">
                <Button
                    variant="outline"
                    onClick={step === 'result' ? onSuccess : onCancel}
                    disabled={loading}
                    className="w-32 bg-white"
                >
                    {step === 'result' ? 'Cerrar' : 'Cancelar'}
                </Button>

                {step === 'upload' && (
                    <Button
                        disabled={data.length === 0 || loading}
                        onClick={() => setStep('preview')}
                        className="w-48 bg-[#1E40AF] hover:bg-[#1E3A8A] text-white"
                    >
                        Continuar
                    </Button>
                )}

                {step === 'preview' && (
                    <Button
                        disabled={loading}
                        onClick={handleImport}
                        className={`w-56 text-white ${modo === 'upsert' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#1E40AF] hover:bg-[#1E3A8A]'}`}
                    >
                        {loading && <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                        {modo === 'upsert' ? 'Confirmar (Actualizar si existe)' : 'Confirmar Importación'}
                    </Button>
                )}

                {step === 'result' && result && result.fallidos > 0 && (
                    <Button variant="outline" onClick={() => setStep('upload')} className="bg-white">
                        Intentar de nuevo
                    </Button>
                )}
            </div>
        </DialogContent>
    )
}
