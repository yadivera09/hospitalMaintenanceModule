/**
 * src/lib/exportToExcel.ts
 * Utilidad reutilizable para exportar arrays de objetos a archivos .xlsx.
 * Usa la librería SheetJS (xlsx).
 *
 * Uso:
 *   import { exportToExcel } from '@/lib/exportToExcel'
 *   exportToExcel(data, 'nombre-archivo')   // descarga nombre-archivo.xlsx
 */

import * as XLSX from 'xlsx'

/**
 * Convierte un array de objetos en una hoja de cálculo y la descarga
 * como archivo .xlsx en el navegador.
 *
 * @param data     Array de objetos planos. Las claves del primer objeto
 *                 se usan como encabezados de columna.
 * @param filename Nombre del archivo SIN extensión.
 */
export function exportToExcel(data: object[], filename: string): void {
    if (data.length === 0) return

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos')
    XLSX.writeFile(workbook, `${filename}.xlsx`)
}
