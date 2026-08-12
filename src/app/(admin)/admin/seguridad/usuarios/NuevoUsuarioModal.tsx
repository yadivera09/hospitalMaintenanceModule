'use client'

/**
 * src/app/(admin)/admin/seguridad/usuarios/NuevoUsuarioModal.tsx
 *
 * Alta de usuarios del sistema. Crea identidad + roles, sin perfil de técnico:
 * sirve para administradores o cualquier persona que no opere equipos.
 * Para dar de alta a un técnico se sigue usando /admin/tecnicos, que además
 * crea su ficha de negocio.
 *
 * La contraseña temporal se muestra UNA sola vez, al terminar. No se guarda
 * en claro ni hay forma de volver a consultarla: si se pierde, se resetea.
 */

import { useState } from 'react'
import { UserPlus, AlertCircle, Copy, Check, ShieldCheck, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { crearUsuario } from '@/app/actions/seguridad/usuarios'
import type { UsuarioCreado } from '@/app/actions/seguridad/usuarios'
import type { RolConPermisos } from '@/app/actions/seguridad/roles'

interface Props {
    rolesCatalogo: RolConPermisos[]
    /** Se llama tras un alta exitosa, para refrescar el listado. */
    onCreado: () => void
}

const FORM_INICIAL = { nombre: '', apellido: '', email: '', telefono: '', cedula: '' }

export default function NuevoUsuarioModal({ rolesCatalogo, onCreado }: Props) {
    const [abierto, setAbierto] = useState(false)
    const [form, setForm] = useState(FORM_INICIAL)
    const [rolesSeleccionados, setRolesSeleccionados] = useState<string[]>([])
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [advertencia, setAdvertencia] = useState<string | null>(null)
    const [creado, setCreado] = useState<UsuarioCreado | null>(null)
    const [copiado, setCopiado] = useState(false)

    function reiniciar() {
        setForm(FORM_INICIAL)
        setRolesSeleccionados([])
        setError(null)
        setAdvertencia(null)
        setCreado(null)
        setCopiado(false)
    }

    function cerrar() {
        setAbierto(false)
        // Si se acaba de crear un usuario, refrescar al cerrar para que
        // aparezca en la lista.
        if (creado) onCreado()
        reiniciar()
    }

    function toggleRol(rolId: string) {
        setRolesSeleccionados((prev) =>
            prev.includes(rolId) ? prev.filter((id) => id !== rolId) : [...prev, rolId]
        )
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setGuardando(true)
        setError(null)

        const { data, error: err } = await crearUsuario({
            nombre: form.nombre,
            apellido: form.apellido,
            email: form.email,
            telefono: form.telefono || null,
            cedula: form.cedula || null,
            rolIds: rolesSeleccionados,
        })

        setGuardando(false)

        if (!data) {
            setError(err ?? 'No se pudo crear el usuario.')
            return
        }

        // El usuario se creó; si además vino un error, es una advertencia sobre
        // la ficha de técnico y se muestra junto a las credenciales.
        setAdvertencia(err)
        setCreado(data)
    }

    async function copiarPassword() {
        if (!creado) return
        await navigator.clipboard.writeText(creado.passwordTemporal)
        setCopiado(true)
        setTimeout(() => setCopiado(false), 2000)
    }

    const formValido =
        form.nombre.trim() &&
        form.apellido.trim() &&
        form.email.trim() &&
        rolesSeleccionados.length > 0

    return (
        <>
            <Button
                onClick={() => setAbierto(true)}
                className="bg-marca hover:bg-marca-fuerte text-white"
            >
                <UserPlus className="h-4 w-4 mr-1.5" />
                Nuevo usuario
            </Button>

            <Dialog open={abierto} onOpenChange={(v) => (v ? setAbierto(true) : cerrar())}>
                <DialogContent className="sm:max-w-[480px]">

                    {/* ── Éxito: credenciales de un solo uso ── */}
                    {creado ? (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-tinta">
                                    <ShieldCheck className="h-5 w-5 text-ok-tinta" />
                                    Usuario creado
                                </DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4 py-2">
                                <p className="text-sm text-tinta-media">
                                    Entrega estas credenciales a{' '}
                                    <span className="font-medium text-tinta">{creado.email}</span>.
                                    En su primer ingreso deberá configurar la verificación en dos pasos.
                                </p>

                                <div className="rounded-lg border border-aviso-linea bg-aviso-suave p-3">
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <KeyRound className="h-3.5 w-3.5 text-aviso-tinta" />
                                        <span className="text-xs font-medium text-aviso-tinta">
                                            Contraseña temporal
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 rounded border border-aviso-linea bg-panel px-3 py-2 text-sm font-mono text-tinta break-all">
                                            {creado.passwordTemporal}
                                        </code>
                                        <button
                                            type="button"
                                            onClick={copiarPassword}
                                            className="shrink-0 rounded border border-aviso-linea bg-panel p-2 text-aviso-tinta hover:bg-aviso-suave"
                                            title="Copiar"
                                        >
                                            {copiado
                                                ? <Check className="h-4 w-4 text-ok-tinta" />
                                                : <Copy className="h-4 w-4" />}
                                        </button>
                                    </div>

                                    <p className="text-[11px] text-aviso-tinta mt-2 leading-relaxed">
                                        Cópiala ahora: no vuelve a mostrarse. Si se pierde, puedes
                                        generar otra desde la ficha del usuario.
                                    </p>
                                </div>

                                {advertencia && (
                                    <div className="flex items-start gap-2 rounded-lg border border-aviso-linea bg-aviso-suave px-3 py-2.5">
                                        <AlertCircle className="h-4 w-4 text-aviso-tinta shrink-0 mt-0.5" />
                                        <p className="text-xs text-aviso-tinta">{advertencia}</p>
                                    </div>
                                )}
                            </div>

                            <DialogFooter>
                                <Button onClick={cerrar} className="bg-marca hover:bg-marca-fuerte">
                                    Entendido
                                </Button>
                            </DialogFooter>
                        </>
                    ) : (
                        /* ── Formulario ── */
                        <form onSubmit={handleSubmit}>
                            <DialogHeader>
                                <DialogTitle className="text-tinta">Nuevo usuario</DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                                <p className="text-xs text-tinta-tenue leading-relaxed">
                                    Crea una cuenta de acceso al sistema. Si le asignas el rol
                                    <span className="font-medium text-tinta-media"> técnico</span>, se
                                    generará también su ficha para poder asignarle reportes.
                                </p>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="nombre" className="text-xs text-tinta-media">
                                            Nombre
                                        </Label>
                                        <Input
                                            id="nombre"
                                            value={form.nombre}
                                            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="apellido" className="text-xs text-tinta-media">
                                            Apellido
                                        </Label>
                                        <Input
                                            id="apellido"
                                            value={form.apellido}
                                            onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="email" className="text-xs text-tinta-media">
                                        Email
                                    </Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="cedula" className="text-xs text-tinta-media">
                                            Cédula <span className="text-tinta-tenue">(opcional)</span>
                                        </Label>
                                        <Input
                                            id="cedula"
                                            value={form.cedula}
                                            onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="telefono" className="text-xs text-tinta-media">
                                            Teléfono <span className="text-tinta-tenue">(opcional)</span>
                                        </Label>
                                        <Input
                                            id="telefono"
                                            value={form.telefono}
                                            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs text-tinta-media">Roles</Label>
                                    <div className="space-y-1.5 max-h-44 overflow-y-auto rounded-md border border-borde p-2">
                                        {rolesCatalogo.map((rol) => {
                                            const marcado = rolesSeleccionados.includes(rol.id)
                                            return (
                                                <label
                                                    key={rol.id}
                                                    className="flex items-start gap-2.5 rounded p-2 cursor-pointer hover:bg-panel-suave"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={marcado}
                                                        onChange={() => toggleRol(rol.id)}
                                                        className="mt-0.5 h-4 w-4 rounded border-borde text-marca-tinta focus:ring-marca"
                                                    />
                                                    <div>
                                                        <p className="text-sm font-medium text-tinta leading-none">
                                                            {rol.nombre}
                                                        </p>
                                                        {rol.descripcion && (
                                                            <p className="text-xs text-tinta-tenue mt-0.5">
                                                                {rol.descripcion}
                                                            </p>
                                                        )}
                                                        {rol.nombre === 'tecnico' && marcado && (
                                                            <p className="text-[11px] text-marca-tinta mt-1">
                                                                Se creará su ficha de técnico
                                                            </p>
                                                        )}
                                                    </div>
                                                </label>
                                            )
                                        })}
                                    </div>
                                    {rolesSeleccionados.length === 0 && (
                                        <p className="text-[11px] text-tinta-tenue">
                                            Sin al menos un rol, la persona no podrá entrar al sistema.
                                        </p>
                                    )}
                                </div>

                                {error && (
                                    <div className="flex items-start gap-2 rounded-lg border border-critico-linea bg-critico-suave px-3 py-2.5">
                                        <AlertCircle className="h-4 w-4 text-critico-tinta shrink-0 mt-0.5" />
                                        <p className="text-xs text-critico-tinta">{error}</p>
                                    </div>
                                )}
                            </div>

                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={cerrar}
                                    className="border-borde text-tinta-media"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={guardando || !formValido}
                                    className="bg-marca hover:bg-marca-fuerte"
                                >
                                    {guardando ? 'Creando...' : 'Crear usuario'}
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
