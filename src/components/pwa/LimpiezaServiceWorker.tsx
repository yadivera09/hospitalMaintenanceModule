'use client'

import { useEffect } from 'react'
import { limpiarServiceWorkersObsoletos } from '@/lib/pwa/register-sw'

/**
 * Componente sin interfaz: da de baja los service workers registrados fuera del
 * panel del técnico.
 *
 * Va en el layout raíz porque el navegador que hay que curar es justamente el
 * que no consigue pasar del login: el registro correcto lo hace el panel, al
 * que ese usuario nunca llega. Ver limpiarServiceWorkersObsoletos().
 */
export default function LimpiezaServiceWorker() {
    useEffect(() => {
        limpiarServiceWorkersObsoletos().catch(() => {})
    }, [])

    return null
}
