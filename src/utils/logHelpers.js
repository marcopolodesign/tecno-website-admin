import { authService } from '../services/authService'

/**
 * Get current user info for logging
 * @returns {Promise<Object>} User info with id, type, and name
 */
export async function getCurrentUserForLogging() {
  try {
    const user = await authService.getCurrentUser()
    
    if (!user) {
      return {
        id: null,
        type: 'system',
        name: 'Sistema'
      }
    }

    // Determine user type and name
    const userType = user.type || 'seller' // 'seller' or 'coach'
    const userName = `${user.first_name || user.firstName || ''} ${user.last_name || user.lastName || ''}`.trim()

    return {
      id: user.id,
      type: userType,
      name: userName || user.email
    }
  } catch (error) {
    console.error('Error getting current user for logging:', error)
    return {
      id: null,
      type: 'system',
      name: 'Sistema'
    }
  }
}

/**
 * Format log timestamp for display
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Formatted timestamp
 */
export function formatLogTimestamp(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Hace un momento'
  if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`
  if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`
  if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`
  
  return date.toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Get icon for log action type
 * @param {string} actionType - The action type
 * @returns {string} Icon component name or emoji
 */
export function getLogIcon(actionType) {
  const iconMap = {
    // Prospect
    'prospect_created': '📝',
    'prospect_updated': '✏️',
    'prospect_converted_to_lead': '➡️',
    
    // Lead
    'lead_created': '🎯',
    'lead_updated': '✏️',
    'lead_converted_to_user': '✅',
    'lead_status_changed': '🔄',
    
    // User
    'user_created': '👤',
    'user_updated': '✏️',
    
    // Membership
    'membership_created': '🎫',
    'membership_updated': '✏️',
    'membership_renewed': '🔄',
    'membership_changed': '🔀',
    'membership_cancelled': '❌',
    
    // Seller/Coach
    'seller_created': '👔',
    'seller_updated': '✏️',
    'seller_deleted': '🗑️',
    'coach_created': '🏃',
    'coach_updated': '✏️',
    'coach_deleted': '🗑️',
    
    // Auth
    'user_login': '🔐',
    'user_logout': '👋'
  }

  return iconMap[actionType] || '📋'
}

/**
 * Get color class for log action type
 * @param {string} actionType - The action type
 * @returns {string} Tailwind color class
 */
export function getLogColor(actionType) {
  if (actionType.includes('created')) return 'text-success'
  if (actionType.includes('updated') || actionType.includes('changed')) return 'text-warning'
  if (actionType.includes('deleted') || actionType.includes('cancelled')) return 'text-error'
  if (actionType.includes('converted') || actionType.includes('renewed')) return 'text-info'
  return 'text-text-secondary'
}

