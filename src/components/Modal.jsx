"use client"

import { X } from "lucide-react"
import { useEffect } from "react"

export const Modal = ({ isOpen, onClose, title, children, size = "medium" }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  if (!isOpen) return null

  const sizeClasses = {
    small: "max-w-md",
    medium: "max-w-lg",
    large: "max-w-3xl",
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop con blur */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Container */}
      <div
        className={`relative w-full ${sizeClasses[size]} bg-white rounded-2xl shadow-2xl transform transition-all duration-300 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col`}
      >
        {/* Header con gradiente */}
        <div className="relative px-6 py-5 border-b border-gray-100">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/5 to-blue-600/5 rounded-t-2xl" />
          <div className="relative flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors group">
              <X className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content con scroll */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export default Modal;
