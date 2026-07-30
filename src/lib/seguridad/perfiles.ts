/**
 * src/lib/seguridad/perfiles.ts
 *
 * Mantiene los perfiles de negocio alineados con los roles asignados.
 *
 * El problema que resuelve:
 *   El control de acceso mira `usuario_roles`, pero la operación mira las
 *   tablas de perfil. Un usuario con rol 'tecnico' y sin fila en `tecnicos`
 *   pasaba el middleware, entraba a /tecnico/dashboard y ahí se rompía:
 *   getTecnicoActual no lo encontraba, no aparecía en el listado de técnicos
 *   y no se le podía asignar a un reporte, porque los reportes referencian
 *   `tecnicos.id` y no `usuarios.id`.
 *
 * La regla queda expresada en un solo sitio: tener el rol 'tecnico' implica
 * tener ficha de técnico activa, y perderlo la desactiva.
 *
 * Por qué se puede crear la ficha automáticamente sin datos a medias:
 *   Desde la migración 016 la ficha no contiene información propia — nombre,
 *   apellido, email, teléfono y cédula viven en `usuarios`. Las columnas de
 *   `tecnicos` son copias que se sincronizan desde aquí, mientras las 14
 *   consultas que las leen no se migren a leer por join.
 */

/** Nombre del rol que exige perfil de técnico. */
export const ROL_TECNICO = 'tecnico'

/**
 * Crea, reactiva o desactiva la ficha de técnico según corresponda al rol.
 *
 * @param admin      - Cliente service_role.
 * @param usuarioId  - usuarios.id (NO auth.users.id).
 * @param tieneRolTecnico - Si el usuario queda con el rol 'tecnico'.
 * @returns Mensaje de error listo para mostrar, o null si todo fue bien.
 *          No lanza: quien llama ya modificó los roles y debe poder informar
 *          del resultado parcial en vez de romper.
 */
export async function sincronizarPerfilTecnico(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    admin: any,
    usuarioId: string,
    tieneRolTecnico: boolean
): Promise<string | null> {
    try {
        const { data: usuario, error: usuarioErr } = await admin
            .from('usuarios')
            .select('id, user_id, nombre, apellido, email, telefono, cedula, activo')
            .eq('id', usuarioId)
            .single()

        if (usuarioErr) throw usuarioErr

        // Buscar por usuario_id, con respaldo por user_id para fichas antiguas
        // que la migración 016 no alcanzara a vincular.
        const { data: ficha } = await admin
            .from('tecnicos')
            .select('id, activo')
            .or(`usuario_id.eq.${usuario.id},user_id.eq.${usuario.user_id}`)
            .maybeSingle()

        // ── Sin el rol: dar de baja la ficha, nunca borrarla ─────────────────
        // Puede tener reportes asociados; el borrado lo impide la FK y además
        // perdería el histórico de quién intervino cada equipo.
        if (!tieneRolTecnico) {
            if (ficha?.activo) {
                const { error } = await admin
                    .from('tecnicos')
                    .update({ activo: false })
                    .eq('id', ficha.id)

                if (error) throw error
            }
            return null
        }

        // ── Con el rol: la ficha debe existir y reflejar la identidad ────────
        if (ficha) {
            const { error } = await admin
                .from('tecnicos')
                .update({
                    usuario_id: usuario.id,
                    nombre: usuario.nombre,
                    apellido: usuario.apellido,
                    email: usuario.email,
                    telefono: usuario.telefono,
                    cedula: usuario.cedula,
                    activo: usuario.activo,
                })
                .eq('id', ficha.id)

            if (error) throw error
            return null
        }

        const { error: insertErr } = await admin
            .from('tecnicos')
            .insert({
                user_id: usuario.user_id,
                usuario_id: usuario.id,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                email: usuario.email,
                telefono: usuario.telefono,
                cedula: usuario.cedula,
                activo: usuario.activo,
            })

        if (insertErr) {
            // 23505 = unique violation: normalmente una ficha antigua con el
            // mismo email o cédula que no quedó vinculada a esta identidad.
            if (insertErr.code === '23505') {
                return 'Los roles se guardaron, pero ya existe una ficha de técnico con ese email o cédula. Revísala en la sección Técnicos.'
            }
            throw insertErr
        }

        return null
    } catch (err) {
        console.error('[sincronizarPerfilTecnico]', err)
        return 'Los roles se guardaron, pero no se pudo actualizar la ficha de técnico.'
    }
}
