/**
 * src/lib/seguridad/password.ts
 *
 * Generación de contraseñas temporales para altas y reseteos.
 *
 * Por qué es aleatoria y no derivada del nombre:
 *   El esquema anterior componía la contraseña con las primeras letras del
 *   nombre y del apellido más '123'. Quien conociera la convención podía
 *   deducir la contraseña inicial de cualquier persona a partir de su nombre.
 *
 *   El segundo factor no cubre ese hueco: se enrola en el PRIMER ingreso, así
 *   que quien entre antes que la persona legítima registra su propia app
 *   autenticadora y se queda con la cuenta.
 */

import { randomBytes } from 'crypto'

/**
 * Alfabeto sin caracteres ambiguos al dictar o transcribir:
 * sin 0/O, sin 1/l/I. 57 símbolos.
 */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

/** Longitud por defecto: 16 caracteres ≈ 93 bits de entropía. */
const LONGITUD = 16

/**
 * Genera una contraseña temporal aleatoria.
 *
 * Se devuelve una sola vez a quien la crea y no se persiste en claro en
 * ningún lado: si se pierde, se genera otra con resetPasswordUsuario().
 */
export function generarPasswordTemporal(longitud: number = LONGITUD): string {
    const bytes = randomBytes(longitud)

    return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('')
}
