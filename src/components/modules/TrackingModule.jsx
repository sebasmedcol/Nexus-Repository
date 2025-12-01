"use client"

import { useState, useEffect } from "react"
import Modal from "../Modal"
import Button from "../Button"
import {
  proyectosAPI,
  historiasAPI,
  aprobacionesHistoriaAPI,
  evidenciasAPI,
  usuariosAPI,
  empresasAPI,
} from "../../lib/api"
import { useAuth } from "../../contexts/AuthContext"

export const TrackingModule = () => {
  const { currentUser, isManager } = useAuth()

  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [userStories, setUserStories] = useState([])
  const [selectedStories, setSelectedStories] = useState([])
  const [evidenceFile, setEvidenceFile] = useState(null)
  const [showLeaderModal, setShowLeaderModal] = useState(false)
  const [showManagerModal, setShowManagerModal] = useState(false)
  const [showProgressDetailsModal, setShowProgressDetailsModal] = useState(false)
  const [pendingEvidences, setPendingEvidences] = useState([])
  const [projectStories, setProjectStories] = useState({})

  const [projectLeader, setProjectLeader] = useState(null)
  const [projectCompany, setProjectCompany] = useState(null)

  const [managerComment, setManagerComment] = useState("")
  const [uploadingFile, setUploadingFile] = useState(false)
  const [loading, setLoading] = useState(true)

  const onShowToast = (message, type = "info") => {
    alert(message)
  }

  const isValidFileType = (file) => {
    const validTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
    ]
    const validExtensions = [".xls", ".xlsx", ".csv"]
    return validTypes.includes(file.type) || validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
  }

  const uploadToCloudinary = async (file) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("upload_preset", "ml_default")

    const response = await fetch("https://api.cloudinary.com/v1_1/dvvzmnzuo/raw/upload", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      throw new Error("Error al subir archivo a Cloudinary")
    }

    return await response.json()
  }

  useEffect(() => {
    loadProjects()
  }, [currentUser, isManager])

  const loadProjects = async () => {
    try {
      setLoading(true)
      let data

      if (isManager) {
        data = await proyectosAPI.getAll()
      } else {
        data = await proyectosAPI.getByLeader(currentUser.id_usuario)
      }

      const approved = data.filter((p) => p.estado_proyecto === "aprobado")
      setProjects(approved)

      const storiesMap = {}
      for (const project of approved) {
        try {
          const stories = await historiasAPI.getByProject(project.id_proyecto)
          storiesMap[project.id_proyecto] = stories
        } catch (error) {
          console.error(`Error loading stories for project ${project.id_proyecto}:`, error)
          storiesMap[project.id_proyecto] = []
        }
      }
      setProjectStories(storiesMap)
    } catch (error) {
      console.error("Error loading projects:", error)
      onShowToast("Error al cargar proyectos", "error")
    } finally {
      setLoading(false)
    }
  }

  const openLeaderModal = async (project) => {
    setSelectedProject(project)
    const stories = projectStories[project.id_proyecto] || []
    setUserStories(stories)
    setSelectedStories([])
    setEvidenceFile(null)
    setShowLeaderModal(true)
  }

  const openProgressDetailsModal = async (project) => {
    setSelectedProject(project)
    const stories = projectStories[project.id_proyecto] || []
    setUserStories(stories)

    try {
      const leader = await usuariosAPI.getById(project.id_lider)
      setProjectLeader(leader)
    } catch (error) {
      console.error("Error loading leader:", error)
      setProjectLeader(null)
    }

    try {
      const company = await empresasAPI.getById(project.id_empresa)
      setProjectCompany(company)
    } catch (error) {
      console.error("Error loading company:", error)
      setProjectCompany(null)
    }

    const storiesInReview = stories.filter((s) => s.estado_historia === "en_revision")
    const evidences = []
    for (const story of storiesInReview) {
      try {
        const storyEvidences = await evidenciasAPI.getByHistory(story.id_historia)
        evidences.push(...storyEvidences.map((ev) => ({ ...ev, historia: story })))
      } catch (error) {
        console.error("Error loading evidences:", error)
      }
    }
    setPendingEvidences(evidences)

    const pendingIds = storiesInReview.map((s) => s.id_historia)
    setSelectedStories(pendingIds)

    setShowProgressDetailsModal(true)
  }

  const openManagerModal = async (project) => {
    setSelectedProject(project)
    const stories = projectStories[project.id_proyecto] || []
    setUserStories(stories)

    const pendingIds = stories.filter((s) => s.estado_historia === "en_revision").map((s) => s.id_historia)
    setSelectedStories(pendingIds)

    setShowManagerModal(true)
  }

  const submitLeaderProgress = async (e) => {
    e.preventDefault()

    if (selectedStories.length === 0) {
      onShowToast("Debe seleccionar al menos una historia completada", "error")
      return
    }

    if (!evidenceFile) {
      onShowToast("Debe cargar un archivo de evidencia", "error")
      return
    }

    if (!isValidFileType(evidenceFile)) {
      onShowToast("Solo se permiten archivos Excel (.xls, .xlsx) o CSV (.csv)", "error")
      return
    }

    try {
      setUploadingFile(true)
      onShowToast("Subiendo evidencia...", "info")
      const uploadResult = await uploadToCloudinary(evidenceFile)

      for (const storyId of selectedStories) {
        await historiasAPI.update(storyId, {
          estado_historia: "en_revision",
        })

        await evidenciasAPI.create({
          archivo_url: uploadResult.url,
          fecha_subida: new Date().toISOString().split("T")[0],
          estado_evidencia: "pendiente",
          observacion_gerente: null,
          id_historia: storyId,
        })
      }

      onShowToast("Progreso enviado al gerente para aprobación", "success")
      setShowLeaderModal(false)
      loadProjects()
    } catch (error) {
      console.error("Error submitting progress:", error)
      onShowToast(`Error al enviar progreso: ${error.message}`, "error")
    } finally {
      setUploadingFile(false)
    }
  }

  const approveProgress = async (e) => {
    e.preventDefault()

    if (selectedStories.length === 0) {
      onShowToast("Debe seleccionar al menos una historia para aprobar", "error")
      return
    }

    try {
      for (const storyId of selectedStories) {
        await historiasAPI.update(storyId, {
          estado_historia: "aprobado",
        })

        await aprobacionesHistoriaAPI.create({
          fecha: new Date().toISOString().split("T")[0],
          estado: "aprobado",
          comentario: managerComment,
          id_historia: storyId,
          id_gerente: currentUser.id_usuario,
        })
      }

      const allStories = await historiasAPI.getByProject(selectedProject.id_proyecto)
      const allApproved = allStories.every((s) => s.estado_historia === "aprobado")

      if (allApproved) {
        await proyectosAPI.update(selectedProject.id_proyecto, {
          estado_proyecto: "completado",
        })
        onShowToast("Proyecto completado: todas las historias han sido aprobadas", "success")
      } else {
        onShowToast(
          `${selectedStories.length} ${selectedStories.length === 1 ? "historia aprobada" : "historias aprobadas"}`,
          "success",
        )
      }

      setShowProgressDetailsModal(false)
      setShowManagerModal(false)
      loadProjects()
    } catch (error) {
      console.error("Error approving progress:", error)
      onShowToast(`Error al aprobar progreso: ${error.message}`, "error")
    }
  }

  const rejectProgress = async () => {
    if (confirm("¿Está seguro de NO APROBAR este progreso? Las historias volverán a estado pendiente.")) {
      try {
        const pendingStories = userStories.filter((s) => s.estado_historia === "en_revision")

        for (const story of pendingStories) {
          await historiasAPI.update(story.id_historia, {
            estado_historia: "pendiente",
          })
        }

        onShowToast("Progreso no aprobado. Las historias han vuelto a estado pendiente.", "error")
        setShowProgressDetailsModal(false)
        setShowManagerModal(false)
        loadProjects()
      } catch (error) {
        console.error("Error rejecting progress:", error)
        onShowToast(`Error al rechazar progreso: ${error.message}`, "error")
      }
    }
  }

  const toggleStory = (storyId) => {
    setSelectedStories((prev) => (prev.includes(storyId) ? prev.filter((id) => id !== storyId) : [...prev, storyId]))
  }

  const getIncentiveLabel = (incentive) => {
    const labels = {
      economico: "Económico",
      laboral: "Laboral",
      temporal: "Temporal",
      formacion: "Formación",
      recursos: "Recursos",
      otro: "Otro",
    }
    return labels[incentive] || incentive
  }

  if (loading) {
    return <div className="text-center py-8">Cargando proyectos...</div>
  }

  return (
    <div className="space-y-6">
      <div className="mb-8 pb-4 border-b-2 border-gray-200">
        <h2 className="text-4xl font-bold text-blue-600">Seguimiento de Proyectos</h2>
        <p className="text-gray-600 mt-2">Monitoreo de progreso</p>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <h3 className="text-2xl mb-2 text-gray-400">No hay proyectos en seguimiento</h3>
          <p>Los proyectos aprobados aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-6">
          {projects.map((project) => {
            const stories = projectStories[project.id_proyecto] || []
            const approvedCount = stories.filter((s) => s.estado_historia === "aprobado").length
            const pendingCount = stories.filter((s) => s.estado_historia === "en_revision").length
            const totalCount = stories.length
            const progress = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0

            return (
              <div
                key={project.id_proyecto}
                className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all"
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2">
                    <h3 className="text-2xl font-bold text-gray-800 mb-4">{project.nombre}</h3>

                    <div className="space-y-3 mb-6">
                      <div className="flex gap-2">
                        <strong className="text-gray-700">Líder:</strong>
                        <span className="text-gray-600">{currentUser.nombre || "N/A"}</span>
                      </div>
                      <div className="flex gap-2">
                        <strong className="text-gray-700">Empresa:</strong>
                        <span className="text-gray-600">{project.id_empresa}</span>
                      </div>
                      <div className="flex gap-2">
                        <strong className="text-gray-700">Período:</strong>
                        <span className="text-gray-600">
                          {project.fecha_inicio} → {project.fecha_fin}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <strong className="text-gray-700">Incentivo:</strong>
                        <span className="text-gray-600">{getIncentiveLabel(project.incentivo) || "N/A"}</span>
                      </div>
                      <div className="flex gap-2">
                        <strong className="text-gray-700">Historias aprobadas:</strong>
                        <span className="text-gray-600">
                          {approvedCount} de {totalCount}
                        </span>
                      </div>
                      {pendingCount > 0 && (
                        <div className="px-4 py-2 bg-yellow-100 border border-yellow-300 rounded-lg">
                          <strong className="text-yellow-800">⏳ Historias pendientes de aprobación:</strong>{" "}
                          <span className="text-yellow-800 font-semibold">{pendingCount}</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="bg-gray-200 h-6 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 to-purple-700 flex items-center justify-end px-2 text-white text-sm font-semibold transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        >
                          {progress}%
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center">
                    {isManager && pendingCount > 0 ? (
                      <Button onClick={() => openProgressDetailsModal(project)} className="w-full">
                        Aprobar Progreso ({pendingCount})
                      </Button>
                    ) : !isManager ? (
                      <Button onClick={() => openLeaderModal(project)} className="w-full">
                        Actualizar Progreso
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Actualizar Progreso (Líder) */}
      <Modal
        isOpen={showLeaderModal}
        onClose={() => setShowLeaderModal(false)}
        title="Actualizar Progreso del Proyecto"
      >
        {selectedProject && (
          <>
            <div className="bg-gray-50 p-6 rounded-lg mb-6">
              <h4 className="text-xl font-bold text-blue-600 mb-2">{selectedProject.nombre}</h4>
              <p className="text-gray-700">Seleccione las historias completadas</p>
            </div>

            <form onSubmit={submitLeaderProgress} className="space-y-6">
              <div>
                <label className="block mb-2 text-gray-700 font-semibold">Historias de Usuario Completadas</label>
                <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto space-y-2">
                  {userStories.map((story) => (
                    <div
                      key={story.id_historia}
                      className={`flex items-center gap-3 px-4 py-3 bg-white border-2 rounded-lg transition-all ${
                        story.estado_historia === "aprobado" ||
                        story.estado_historia === "en_revision" ||
                        selectedStories.includes(story.id_historia)
                          ? "border-gray-300 opacity-60 bg-gray-50"
                          : "border-gray-200 hover:border-blue-600 hover:bg-blue-50 cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        id={`story-${story.id_historia}`}
                        checked={
                          story.estado_historia === "aprobado" ||
                          story.estado_historia === "en_revision" ||
                          selectedStories.includes(story.id_historia)
                        }
                        onChange={() => toggleStory(story.id_historia)}
                        disabled={story.estado_historia === "aprobado" || story.estado_historia === "en_revision"}
                        className="w-5 h-5 cursor-pointer"
                      />
                      <label htmlFor={`story-${story.id_historia}`} className="flex-1 cursor-pointer">
                        {story.descripcion}
                        {story.estado_historia === "aprobado" && <em className="text-green-600 ml-2">(Aprobada)</em>}
                        {story.estado_historia === "en_revision" && (
                          <em className="text-yellow-600 ml-2">(Pendiente de aprobación)</em>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block mb-2 text-gray-700 font-semibold">Archivo de Evidencia *</label>
                <input
                  type="file"
                  onChange={(e) => setEvidenceFile(e.target.files[0])}
                  required
                  accept=".xls,.xlsx,.csv"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
                <small className="block mt-2 text-gray-600">
                  Solo se aceptan archivos Excel (.xls, .xlsx) y CSV (.csv)
                </small>
              </div>

              <div className="flex gap-4 justify-end pt-4 border-t-2 border-gray-200">
                <Button type="button" variant="secondary" onClick={() => setShowLeaderModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={uploadingFile}>
                  {uploadingFile ? "Subiendo..." : "Enviar Progreso"}
                </Button>
              </div>
            </form>
          </>
        )}
      </Modal>

      {/* Modal Detalles del Progreso (Gerente) */}
      <Modal
        isOpen={showProgressDetailsModal}
        onClose={() => setShowProgressDetailsModal(false)}
        title="Detalles del Progreso"
        size="large"
      >
        {selectedProject && (
          <>
            <div className="bg-gray-50 p-6 rounded-lg mb-6">
              <h4 className="text-xl font-bold text-blue-600 mb-2">{selectedProject.nombre}</h4>
              <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                <div>
                  <strong className="text-gray-700">Líder:</strong>
                  <span className="text-gray-600 ml-2">{projectLeader?.nombre || "Cargando..."}</span>
                </div>
                <div>
                  <strong className="text-gray-700">Empresa:</strong>
                  <span className="text-gray-600 ml-2">{projectCompany?.nombre || "Cargando..."}</span>
                </div>
                <div>
                  <strong className="text-gray-700">Período:</strong>
                  <span className="text-gray-600 ml-2">
                    {selectedProject.fecha_inicio} → {selectedProject.fecha_fin}
                  </span>
                </div>
                <div>
                  <strong className="text-gray-700">Incentivo:</strong>
                  <span className="text-gray-600 ml-2">{getIncentiveLabel(selectedProject.incentivo) || "N/A"}</span>
                </div>
              </div>

              <div className="mt-4">
                <strong className="text-gray-700">Historias aprobadas:</strong>
                <span className="text-gray-600 ml-2">
                  {projectStories[selectedProject.id_proyecto]?.filter((s) => s.estado_historia === "aprobado")
                    .length || 0}{" "}
                  de {projectStories[selectedProject.id_proyecto]?.length || 0}
                </span>
              </div>

              {projectStories[selectedProject.id_proyecto]?.filter((s) => s.estado_historia === "en_revision").length >
                0 && (
                <div className="mt-2 flex items-center gap-2 p-3 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                  <span className="text-xl">⏳</span>
                  <span className="font-semibold text-gray-800">
                    Historias pendientes de aprobación:{" "}
                    {
                      projectStories[selectedProject.id_proyecto]?.filter((s) => s.estado_historia === "en_revision")
                        .length
                    }
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <label className="block mb-3 text-gray-700 font-semibold text-lg">
                  Historias Pendientes de Aprobación (
                  {userStories.filter((s) => s.estado_historia === "en_revision").length})
                </label>
                <div className="border-2 border-yellow-300 bg-yellow-50 rounded-lg p-4 max-h-96 overflow-y-auto space-y-3">
                  {userStories
                    .filter((s) => s.estado_historia === "en_revision")
                    .map((story) => {
                      const storyEvidences = pendingEvidences.filter((ev) => ev.id_historia === story.id_historia)
                      return (
                        <div key={story.id_historia} className="bg-white border-2 border-gray-200 rounded-lg p-4">
                          <div className="flex items-start gap-3 mb-3">
                            <input
                              type="checkbox"
                              id={`story-detail-${story.id_historia}`}
                              checked={selectedStories.includes(story.id_historia)}
                              onChange={() => toggleStory(story.id_historia)}
                              className="w-5 h-5 cursor-pointer mt-1"
                            />
                            <div className="flex-1">
                              <label
                                htmlFor={`story-detail-${story.id_historia}`}
                                className="cursor-pointer font-medium text-gray-800"
                              >
                                {story.descripcion}
                              </label>
                            </div>
                          </div>
                          {storyEvidences.length > 0 && (
                            <div className="ml-8 mt-2 space-y-2">
                              {storyEvidences.map((evidence, idx) => (
                                <div
                                  key={evidence.id_evidencia}
                                  className="p-3 bg-blue-50 border border-blue-200 rounded"
                                >
                                  <div className="text-sm">
                                    <strong className="text-blue-800">Evidencia {idx + 1}:</strong>
                                    <div className="mt-1">
                                      <a
                                        href={evidence.archivo_url}
                                        download
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          className="h-4 w-4"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                          />
                                        </svg>
                                        Descargar evidencia
                                      </a>
                                    </div>
                                    <div className="mt-2 text-gray-600">
                                      <strong>Fecha de subida:</strong> {evidence.fecha_subida}
                                    </div>
                                    {evidence.estado_evidencia && (
                                      <div className="mt-1 text-gray-600">
                                        <strong>Estado:</strong> {evidence.estado_evidencia}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>
              </div>

              <div className="flex gap-4 justify-end pt-4 border-t-2 border-gray-200">
                <Button type="button" variant="danger" onClick={rejectProgress}>
                  Rechazar
                </Button>
                <Button type="button" variant="success" onClick={approveProgress}>
                  Aprobar Seleccionadas
                </Button>
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* Modal Aprobar Progreso (Gerente) */}
      <Modal isOpen={showManagerModal} onClose={() => setShowManagerModal(false)} title="Aprobar Progreso del Proyecto">
        {selectedProject && (
          <>
            <div className="bg-gray-50 p-6 rounded-lg mb-6">
              <h4 className="text-xl font-bold text-blue-600 mb-2">{selectedProject.nombre}</h4>
              <p className="text-gray-700">
                <strong>{userStories.filter((s) => s.estado_historia === "en_revision").length}</strong> historias
                pendientes de aprobación
              </p>
            </div>

            <form onSubmit={approveProgress} className="space-y-6">
              <div>
                <label className="block mb-2 text-gray-700 font-semibold">
                  Historias de Usuario Pendientes de Aprobación
                </label>
                <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto space-y-2">
                  {userStories
                    .filter((s) => s.estado_historia === "en_revision")
                    .map((story) => (
                      <div
                        key={story.id_historia}
                        className={`flex items-center gap-3 px-4 py-3 bg-white border-2 rounded-lg transition-all ${
                          selectedStories.includes(story.id_historia) ? "border-blue-600 bg-blue-50" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          id={`story-mgr-${story.id_historia}`}
                          checked={selectedStories.includes(story.id_historia)}
                          onChange={() => toggleStory(story.id_historia)}
                          className="w-5 h-5 cursor-pointer"
                        />
                        <label htmlFor={`story-mgr-${story.id_historia}`} className="flex-1 cursor-pointer">
                          {story.descripcion}
                        </label>
                      </div>
                    ))}
                </div>
              </div>

              <div className="flex gap-4 justify-end pt-4 border-t-2 border-gray-200">
                <Button type="button" variant="danger" onClick={rejectProgress}>
                  No Aprobar
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowManagerModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Aprobar Historias</Button>
              </div>
            </form>
          </>
        )}
      </Modal>
    </div>
  )
}

export default TrackingModule
