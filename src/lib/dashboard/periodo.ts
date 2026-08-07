/**
 * src/lib/dashboard/periodo.ts
 * Ventana temporal de las métricas de actividad del dashboard.
 *
 * Vive fuera de app/actions/dashboard.ts a la fuerza: un archivo marcado con
 * 'use server' solo puede exportar funciones asíncronas, porque cada exportación
 * se convierte en un endpoint invocable desde el cliente. Una constante o una
 * función síncrona ahí rompen la compilación entera del módulo — y con ella
 * cualquier página que lo importe, incluido el login.
 *
 * Los tipos sí pueden quedarse allí (se borran al compilar), pero PERIODOS y
 * esPeriodo son valores en tiempo de ejecución.
 */

export type Periodo = 'hoy' | 'semana' | 'mes' | 'bimestre' | 'trimestre' | 'anio'

export const PERIODOS: { clave: Periodo; etiqueta: string; dias: number }[] = [
    { clave: 'hoy',       etiqueta: 'Hoy',       dias: 1 },
    { clave: 'semana',    etiqueta: '7 días',    dias: 7 },
    { clave: 'mes',       etiqueta: '30 días',   dias: 30 },
    { clave: 'bimestre',  etiqueta: '2 meses',   dias: 60 },
    { clave: 'trimestre', etiqueta: '3 meses',   dias: 90 },
    { clave: 'anio',      etiqueta: '1 año',     dias: 365 },
]

export const PERIODO_POR_DEFECTO: Periodo = 'mes'

export function esPeriodo(valor: string | undefined): valor is Periodo {
    return PERIODOS.some((p) => p.clave === valor)
}

/** Definición del periodo, con caída al de por defecto si llega uno desconocido. */
export function definicionPeriodo(periodo: Periodo) {
    return PERIODOS.find((p) => p.clave === periodo) ?? PERIODOS[2]
}
