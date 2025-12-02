"use client"

import { useAuth } from "../contexts/AuthContext"
import { LogOut, User, Shield, Bell, CheckCircle2, RotateCcw, XCircle, Clock, Sparkles, Upload } from "lucide-react"
import { useEffect, useState } from "react"
import { proyectosAPI, aprobacionesAPI, aprobacionesHistoriaAPI, historiasAPI, evidenciasAPI } from "../lib/api"

export const Header = () => {
  const { currentUser, logout, isManager } = useAuth()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)

  const lastSeenKey = currentUser ? `mvmNexusLastSeen_${currentUser.id_usuario}` : null

  const refreshNotifications = async () => {
    if (!currentUser) return
    const ts = lastSeenKey ? sessionStorage.getItem(lastSeenKey) : null
    const lastSeen = ts ? new Date(ts) : null
    const items = []
    if (isManager) {
      const projects = await proyectosAPI.getAll()
      const pending = projects.filter((p) => p.estado_proyecto === "pendiente")
      for (const p of pending) {
        if (!lastSeen || (p.fecha_creacion && new Date(p.fecha_creacion) > lastSeen)) {
          items.push({ id: `pending_${p.id_proyecto}`, text: `Nuevo proyecto pendiente: ${p.nombre}`, ts: p.fecha_creacion || new Date().toISOString(), type: "pendiente" })
        }
      }
      const evidences = await evidenciasAPI.getAll()
      const historias = await historiasAPI.getAll()
      const histToProj = new Map(historias.map((h) => [h.id_historia, h.id_proyecto]))
      for (const ev of evidences) {
        if (!lastSeen || (ev.fecha_subida && new Date(ev.fecha_subida) > lastSeen)) {
          const pid = histToProj.get(ev.id_historia)
          const proj = projects.find((pp) => pp.id_proyecto === pid)
          items.push({ id: `evidence_${ev.id_evidencia}`, text: `Nueva evidencia en ${proj?.nombre || pid}`, ts: ev.fecha_subida || new Date().toISOString(), type: "evidencia" })
        }
      }
    } else {
      const projects = await proyectosAPI.getByLeader(currentUser.id_usuario)
      const pids = projects.map((p) => p.id_proyecto)
      const approvals = await aprobacionesAPI.getAll()
      for (const ap of approvals) {
        if (pids.includes(ap.id_proyecto)) {
          if (!lastSeen || (ap.fecha_aprobacion && new Date(ap.fecha_aprobacion) > lastSeen)) {
            const proj = projects.find((p) => p.id_proyecto === ap.id_proyecto)
            let label = ap.estado_asignado === "aprobado" ? "Proyecto aprobado" : ap.estado_asignado === "devuelto" ? "Proyecto devuelto" : ap.estado_asignado === "rechazado" ? "Proyecto no aprobado" : `Estado: ${ap.estado_asignado}`
            items.push({ id: `approval_${ap.id_aprobacion || ap.id_aprobacion_proyecto || Math.random()}`, text: `${label}: ${proj?.nombre || ap.id_proyecto}`, ts: ap.fecha_aprobacion || new Date().toISOString(), type: ap.estado_asignado })
          }
        }
      }
      const historias = await historiasAPI.getAll()
      const myHist = historias.filter((h) => pids.includes(h.id_proyecto))
      const histIds = new Set(myHist.map((h) => h.id_historia))
      const storyApprovals = await aprobacionesHistoriaAPI.getAll()
      for (const ah of storyApprovals) {
        if (histIds.has(ah.id_historia) && ah.estado === "aprobado") {
          if (!lastSeen || (ah.fecha && new Date(ah.fecha) > lastSeen)) {
            const story = myHist.find((h) => h.id_historia === ah.id_historia)
            const proj = projects.find((p) => p.id_proyecto === story?.id_proyecto)
            items.push({ id: `hist_${ah.id_aprobacion_historia || Math.random()}`, text: `Historia aprobada en ${proj?.nombre || story?.id_proyecto}`, ts: ah.fecha || new Date().toISOString(), type: "historia" })
          }
        }
      }
    }
    items.sort((a, b) => new Date(b.ts) - new Date(a.ts))
    setNotifications(items)
    const count = items.filter((it) => !ts || new Date(it.ts) > new Date(ts)).length
    setUnread(count)
  }

  useEffect(() => {
    let i
    refreshNotifications()
    i = setInterval(refreshNotifications, 30000)
    return () => {
      if (i) clearInterval(i)
    }
  }, [currentUser, isManager])

  const toggleOpen = () => {
    const next = !open
    setOpen(next)
    if (!next && lastSeenKey) {
      sessionStorage.setItem(lastSeenKey, new Date().toISOString())
      setUnread(0)
      setNotifications([])
    }
  }

  const markAllSeen = () => {
    if (lastSeenKey) {
      sessionStorage.setItem(lastSeenKey, new Date().toISOString())
    }
    setUnread(0)
    setNotifications([])
    setOpen(false)
  }

  return (
    <header className="bg-gradient-to-r from-purple-900 via-purple-800 to-blue-900 border-b border-white/10 shadow-lg sticky top-0 z-30">
      <div className="px-6 py-4">
        <div className="flex justify-between items-center">
          {/* Título - Ya no es necesario porque está en el sidebar */}
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 bg-gradient-to-b from-purple-400 to-blue-400 rounded-full"></div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {currentUser?.nombre
                  ?.toLowerCase()
                  .replace(/^\w/, (c) => c.toUpperCase())}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button onClick={toggleOpen} className="relative p-2 rounded-lg hover:bg-white/10 text-purple-100 hover:text-white transition-colors" title="Notificaciones">
                <Bell className="w-5 h-5" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{unread}</span>
                )}
              </button>
              {open && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Actividad</span>
                    <span className="text-xs text-gray-400">{isManager ? "Gerente" : "Líder"}</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-gray-500 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        No hay actividad nueva
                      </div>
                    ) : (
                      notifications.slice(0, 10).map((n) => (
                        <div key={n.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
                          {n.type === "aprobado" && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                          {n.type === "devuelto" && <RotateCcw className="w-4 h-4 text-orange-600" />}
                          {n.type === "rechazado" && <XCircle className="w-4 h-4 text-red-600" />}
                          {n.type === "pendiente" && <Clock className="w-4 h-4 text-amber-600" />}
                          {n.type === "evidencia" && <Upload className="w-4 h-4 text-blue-600" />}
                          {n.type === "historia" && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                          <span className="text-sm text-gray-700">{n.text}</span>
                        </div>
                      ))
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <div className="px-4 py-2 border-t border-gray-100">
                      <button onClick={markAllSeen} className="w-full text-xs font-semibold text-purple-600 hover:text-purple-700">
                        Marcar todo como leído
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Badge de rol */}
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-lg backdrop-blur-sm">
              {isManager ? (
                <Shield className="w-4 h-4 text-purple-300" />
              ) : (
                <User className="w-4 h-4 text-blue-300" />
              )}
              <span className="text-sm font-medium text-white">
                {isManager ? "Gerente" : "Líder de Proyecto"}
              </span>
            </div>

            {/* Botón de Logout */}
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 text-purple-100 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200 group"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">Salir</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
