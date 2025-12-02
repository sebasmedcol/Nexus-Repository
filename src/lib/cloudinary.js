const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = "nexuss" // Con doble 's'

export const uploadToCloudinary = async (file) => {
  console.log("[v0] Cloudinary config:", { CLOUD_NAME, UPLOAD_PRESET })

  if (!CLOUD_NAME) {
    throw new Error("VITE_CLOUDINARY_CLOUD_NAME no está configurado")
  }

  const formData = new FormData()
  formData.append("file", file)
  formData.append("upload_preset", "nexuss") // CON DOBLE 'S'
  // NO incluyas api_key, timestamp, ni signature para unsigned uploads

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`,
      {
        method: "POST",
        body: formData,
      }
    )

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