/**
 * src/lib/validators.ts
 * Utilidades de validación de negocio.
 */

/**
 * Valida una cédula ecuatoriana.
 * @param cedula String de 10 dígitos.
 * @returns boolean true si es válida.
 */
export function validarCedulaEcuatoriana(cedula: string): boolean {
    // Debe tener exactamente 10 dígitos y ser numérica
    if (!/^\d{10}$/.test(cedula)) return false

    // Los dos primeros dígitos corresponden a la provincia (01 a 24)
    const provincia = parseInt(cedula.substring(0, 2), 10)
    if (provincia < 1 || provincia > 24) return false

    // El tercer dígito debe ser menor a 6
    const tercerDigito = parseInt(cedula.substring(2, 3), 10)
    if (tercerDigito >= 6) return false

    // Algoritmo de validación (Módulo 10)
    const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2]
    const verificador = parseInt(cedula.substring(9, 10), 10)
    let suma = 0

    for (let i = 0; i < 9; i++) {
        let valor = parseInt(cedula.substring(i, i + 1), 10) * coeficientes[i]
        if (valor >= 10) valor -= 9
        suma += valor
    }

    const residuo = suma % 10
    const resultado = residuo === 0 ? 0 : 10 - residuo

    return resultado === verificador
}
