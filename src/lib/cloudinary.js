const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const API_KEY = import.meta.env.VITE_CLOUDINARY_KEY

// Generar timestamp para la firma
const generateSignature = (timestamp) => {
  // En producción, esto debería hacerse en el backend
  // Por ahora usamos upload preset sin firma
  return null
}

export const uploadToCloudinary = async (file) => {
  console.log("[v0] Cloudinary config:", { CLOUD_NAME, API_KEY: API_KEY ? "presente" : "faltante" })

  if (!CLOUD_NAME) {
    throw new Error("VITE_CLOUDINARY_CLOUD_NAME no está configurado")
  }

  const formData = new FormData()
  formData.append("file", file)
  formData.append("folder", "nexus-evidencias")
  formData.append("api_key", API_KEY)

  // Usar upload preset público (debe estar configurado en Cloudinary)
  // Si no tienes un preset, créalo en: Cloudinary Dashboard > Settings > Upload > Upload presets
  formData.append("upload_preset", "nexuss") // Este preset debe existir en tu cuenta

  const timestamp = Math.round(Date.now() / 1000)
  formData.append("timestamp", timestamp)

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      console.error("[v0] Cloudinary error response:", error)
      throw new Error(error.error?.message || "Error al subir archivo")
    }

    const data = await response.json()
    console.log("[v0] Cloudinary upload success:", data.secure_url)
    return {
      url: data.secure_url,
      publicId: data.public_id,
      format: data.format,
      bytes: data.bytes,
    }
  } catch (error) {
    console.error("Cloudinary upload error:", error)
    throw new Error(`Error al subir archivo: ${error.message}`)
  }
}

export const isValidFileType = (file) => {
  const validTypes = [
    "application/vnd.ms-excel", // .xls
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "text/csv", // .csv
  ]
  const validExtensions = [".xls", ".xlsx", ".csv"]
  const fileName = file.name.toLowerCase()
  const hasValidExtension = validExtensions.some((ext) => fileName.endsWith(ext))

  return validTypes.includes(file.type) || hasValidExtension
}
