// Where an exercise's video actually comes from, and how it should be framed.
//
// Until Sprint 1 an exercise could only carry a pasted YouTube link, which the TV rendered
// in an <iframe> and the app could not play at all — expo-video only plays direct files.
// Now the gym's own footage is hosted and processed into one rendition per destination, so
// both screens can read the same row and get the file that suits them.
//
// Rows store storage keys, not URLs. Putting a CDN in front later, or renaming a bucket,
// changes this file and nothing else.

const BUCKET = 'exercise-media'

const baseUrl = () => (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')

export function mediaUrl(path) {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  return `${baseUrl()}/storage/v1/object/public/${BUCKET}/${path}`
}

// The framing is stored as data and applied here, never baked into the file. That is what
// makes re-framing an exercise instant and reversible: nothing is re-uploaded and nothing
// is re-encoded, the same rendition is simply shown through a different window.
//
// The rect is normalised 0-1 against the source frame: {x, y, w, h}. Showing it means
// scaling the frame up by 1/w and shifting it so the rect lands in the viewport.
export function cropStyle(crop) {
  if (!crop || !crop.w || !crop.h) return { width: '100%', height: '100%', objectFit: 'cover' }
  const scaleX = 1 / crop.w
  const scaleY = 1 / crop.h
  return {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transformOrigin: '0 0',
    transform: `scale(${scaleX}, ${scaleY}) translate(${-crop.x * 100}%, ${-crop.y * 100}%)`,
  }
}

// `destino` is 'tv' or 'app' — the two have their own rendition and their own framing, and
// neither is derived from the other.
export function exerciseMedia(ex, destino = 'tv') {
  if (!ex) return { kind: 'empty' }

  const listo = ex.processing_status === 'ready'
  const path = destino === 'app' ? ex.app_path : ex.tv_path
  const crop = destino === 'app' ? ex.crop_app : ex.crop_tv

  if (listo && path) {
    return {
      kind: 'hosted',
      src: mediaUrl(path),
      poster: mediaUrl(ex.poster_path),
      crop: crop || null,
      style: cropStyle(crop),
      // Which span of the clip loops. Stored, never baked in — same reason as the crop, and
      // the same for both destinations: the interesting reps do not move between screens.
      recorte:
        ex.recorte_inicio != null || ex.recorte_fin != null
          ? { inicio: Number(ex.recorte_inicio) || 0, fin: Number(ex.recorte_fin) || null }
          : null,
    }
  }

  // Everything below is the old world, kept because the catalog is loaded exercise by
  // exercise: on any given day some rows have our renditions and some still have whatever
  // link was pasted into them.
  if (ex.video_platform === 'direct' && ex.video_url) {
    return { kind: 'hosted', src: ex.video_url, poster: ex.video_thumbnail_url || null, crop: null, style: cropStyle(null) }
  }
  if (ex.video_platform === 'youtube' && ex.video_embed_id) {
    return { kind: 'youtube', embedId: ex.video_embed_id }
  }
  if (ex.video_thumbnail_url) {
    return { kind: 'image', src: ex.video_thumbnail_url }
  }
  return { kind: 'empty' }
}

// The columns any screen showing exercise video needs. Kept here so a new screen cannot
// half-select them and silently fall back to the legacy path.
export const EXERCISE_MEDIA_FIELDS =
  'id, name, description, code, video_url, video_thumbnail_url, video_platform, video_embed_id, ' +
  'tv_path, app_path, poster_path, crop_tv, crop_app, processing_status, media_version, duration_seconds, ' +
  'recorte_inicio, recorte_fin'
