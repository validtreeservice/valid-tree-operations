// Photos stay private inside the saved proposal; strips EXIF/GPS through re-encoding.
export async function prepareProposalPhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Use JPG, PNG or WebP photos. Export HEIC photos as JPG first.')
  if (file.size > 25000000) throw new Error('Choose a photo smaller than 25 MB.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('This photo could not be read.')
    const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale)
    const context = canvas.getContext('2d')
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    for (const quality of [.82, .7, .58, .45]) {
      const data = canvas.toDataURL('image/jpeg', quality)
      if (data.length <= 350000) return { id: crypto.randomUUID(), data, caption: '' }
    }
    throw new Error('This photo is too detailed to fit. Resize it smaller and try again.')
  } finally { URL.revokeObjectURL(url) }
}
