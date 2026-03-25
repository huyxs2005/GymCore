import { useEffect, useMemo, useRef, useState } from 'react'
import Cropper from 'react-easy-crop'
import { X } from 'lucide-react'

function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', reject)
    image.crossOrigin = 'anonymous'
    image.src = url
  })
}

async function getCroppedBlob(imageSrc, cropPixels, outputSize = 512) {
  const image = await createImage(imageSrc)

  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas is not supported in this browser.')
  }

  // Draw the selected crop area into a square output.
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    outputSize,
    outputSize,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Failed to crop image.'))
        else resolve(blob)
      },
      'image/jpeg',
      0.92,
    )
  })
}

function AvatarCropDialog({ file, open, onClose, onConfirm, maxBytes = 5 * 1024 * 1024 }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [cropPixels, setCropPixels] = useState(null)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const objectUrlRef = useRef('')

  const imageUrl = useMemo(() => {
    if (!file) return ''
    return URL.createObjectURL(file)
  }, [file])

  useEffect(() => {
    if (!imageUrl) return
    objectUrlRef.current = imageUrl
    return () => {
      try {
        URL.revokeObjectURL(imageUrl)
      } catch {
        // ignore
      }
    }
  }, [imageUrl])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    setError('')
    setIsSaving(false)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCropPixels(null)
  }, [open, file])

  async function handleSave() {
    if (!file || !cropPixels) return
    try {
      setError('')
      setIsSaving(true)
      const blob = await getCroppedBlob(imageUrl, cropPixels, 512)
      if (blob.size > maxBytes) {
        throw new Error('Cropped image is too large. Try zooming out or choosing a smaller image.')
      }
      const croppedFile = new File([blob], 'avatar.jpg', { type: blob.type })
      await onConfirm?.(croppedFile)
    } catch (e) {
      setError(e?.message || 'Failed to crop image.')
      setIsSaving(false)
    }
  }

  if (!open || !file) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Adjust profile photo</h2>
            <p className="mt-1 text-sm text-slate-600">Drag to reposition. Use the slider to zoom.</p>
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative h-[380px] bg-slate-900">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setCropPixels(pixels)}
            objectFit="horizontal-cover"
          />
        </div>

        <div className="space-y-3 px-5 py-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </label>

          {error ? <p className="text-sm text-rose-700">{error}</p> : null}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onClose?.()}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !cropPixels}
              className="rounded-lg bg-gym-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gym-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? 'Saving...' : 'Save photo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AvatarCropDialog

