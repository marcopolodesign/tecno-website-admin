import { supabase } from '../lib/supabase'

const toCamelCase = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase)
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      acc[camelKey] = toCamelCase(obj[key])
      return acc
    }, {})
  }
  return obj
}

const logsService = {
  /**
   * Create a new log entry
   * @param {Object} logData - The log data
   * @param {string} logData.actionType - Type of action (e.g., 'user_created')
   * @param {string} logData.actionDescription - Human-readable description
   * @param {string} logData.performedById - ID of user who performed action (optional for system actions)
   * @param {string} logData.performedByType - Type: 'seller', 'coach', or 'system'
   * @param {string} logData.performedByName - Name of performer
   * @param {string} logData.entityType - Type of entity affected
   * @param {string} logData.entityId - ID of affected entity
   * @param {string} logData.entityName - Name of affected entity
   * @param {string} logData.relatedUserId - Optional: link to user
   * @param {string} logData.relatedMembershipId - Optional: link to membership
   * @param {Object} logData.changes - Optional: before/after values
   * @param {Object} logData.metadata - Optional: additional context
   */
  async createLog(logData) {
    try {
      const log = {
        action_type: logData.actionType,
        action_description: logData.actionDescription,
        performed_by_id: logData.performedById || null,
        performed_by_type: logData.performedByType || 'system',
        performed_by_name: logData.performedByName || 'Sistema',
        entity_type: logData.entityType,
        entity_id: logData.entityId,
        entity_name: logData.entityName || null,
        related_user_id: logData.relatedUserId || null,
        related_membership_id: logData.relatedMembershipId || null,
        changes: logData.changes || null,
        metadata: logData.metadata || null
      }

      const { data, error } = await supabase
        .from('logs')
        .insert([log])
        .select()
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error creating log:', error)
      // Don't throw - logging should never break the main flow
      return { data: null, error }
    }
  },

  /**
   * Get logs for a specific user
   */
  async getUserLogs(userId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('logs')
        .select('*')
        .eq('related_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching user logs:', error)
      throw error
    }
  },

  /**
   * Get logs for a specific membership
   */
  async getMembershipLogs(membershipId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('logs')
        .select('*')
        .eq('related_membership_id', membershipId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching membership logs:', error)
      throw error
    }
  },

  /**
   * Get logs performed by a specific user (seller/coach)
   */
  async getLogsByPerformer(performerId, limit = 100) {
    try {
      const { data, error } = await supabase
        .from('logs')
        .select('*')
        .eq('performed_by_id', performerId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching logs by performer:', error)
      throw error
    }
  },

  /**
   * Get recent activity (all logs)
   */
  async getRecentActivity(limit = 100) {
    try {
      const { data, error } = await supabase
        .from('logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching recent activity:', error)
      throw error
    }
  },

  /**
   * Get logs by action type
   */
  async getLogsByActionType(actionType, limit = 100) {
    try {
      const { data, error } = await supabase
        .from('logs')
        .select('*')
        .eq('action_type', actionType)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching logs by action type:', error)
      throw error
    }
  },

  // ============================================================================
  // HELPER METHODS FOR COMMON LOG TYPES
  // ============================================================================

  /**
   * Log prospect creation from website form
   */
  async logProspectCreated(prospectId, prospectName, prospectData) {
    return this.createLog({
      actionType: 'prospect_created',
      actionDescription: `Nuevo prospecto desde formulario web: ${prospectName}`,
      performedByType: 'system',
      performedByName: 'Sistema Automático',
      entityType: 'prospect',
      entityId: prospectId,
      entityName: prospectName,
      changes: {
        email: prospectData.email,
        phone: prospectData.phone,
        training_goal: prospectData.trainingGoal,
        utm_source: prospectData.utmSource,
        utm_medium: prospectData.utmMedium,
        utm_campaign: prospectData.utmCampaign
      },
      metadata: {
        source: 'website_form',
        timestamp: new Date().toISOString()
      }
    })
  },

  /**
   * Log prospect converted to lead
   */
  async logProspectConvertedToLead(prospectId, leadId, prospectName, performedBy) {
    return this.createLog({
      actionType: 'prospect_converted_to_lead',
      actionDescription: `Prospecto convertido a lead: ${prospectName}`,
      performedById: performedBy.id,
      performedByType: performedBy.type,
      performedByName: performedBy.name,
      entityType: 'lead',
      entityId: leadId,
      entityName: prospectName,
      changes: {
        from_prospect_id: prospectId,
        to_lead_id: leadId
      }
    })
  },

  /**
   * Log lead converted to user with membership
   */
  async logLeadConvertedToUser(leadId, userId, membershipId, userName, membershipData, performedBy) {
    return this.createLog({
      actionType: 'lead_converted_to_user',
      actionDescription: `Lead convertido a usuario con membresía ${membershipData.type}: ${userName}`,
      performedById: performedBy.id,
      performedByType: performedBy.type,
      performedByName: performedBy.name,
      entityType: 'user',
      entityId: userId,
      entityName: userName,
      relatedUserId: userId,
      relatedMembershipId: membershipId,
      changes: {
        from_lead_id: leadId,
        membership_type: membershipData.type,
        start_date: membershipData.startDate,
        end_date: membershipData.endDate,
        payment_method: membershipData.paymentMethod,
        payment_amount: membershipData.paymentAmount
      }
    })
  },

  /**
   * Log membership created
   */
  async logMembershipCreated(membershipId, userId, userName, membershipData, performedBy) {
    return this.createLog({
      actionType: 'membership_created',
      actionDescription: `Membresía ${membershipData.type} creada para ${userName}`,
      performedById: performedBy.id,
      performedByType: performedBy.type,
      performedByName: performedBy.name,
      entityType: 'membership',
      entityId: membershipId,
      entityName: `Membresía ${membershipData.type}`,
      relatedUserId: userId,
      relatedMembershipId: membershipId,
      changes: {
        membership_type: membershipData.type,
        start_date: membershipData.startDate,
        end_date: membershipData.endDate,
        payment_method: membershipData.paymentMethod,
        payment_amount: membershipData.paymentAmount
      }
    })
  },

  /**
   * Log membership changed
   */
  async logMembershipChanged(membershipId, userId, userName, oldData, newData, performedBy) {
    return this.createLog({
      actionType: 'membership_changed',
      actionDescription: `Membresía modificada de ${oldData.type} a ${newData.type} para ${userName}`,
      performedById: performedBy.id,
      performedByType: performedBy.type,
      performedByName: performedBy.name,
      entityType: 'membership',
      entityId: membershipId,
      entityName: `Membresía ${newData.type}`,
      relatedUserId: userId,
      relatedMembershipId: membershipId,
      changes: {
        old_type: oldData.type,
        new_type: newData.type,
        old_start_date: oldData.startDate,
        new_start_date: newData.startDate,
        old_end_date: oldData.endDate,
        new_end_date: newData.endDate,
        old_status: oldData.status,
        new_status: newData.status
      }
    })
  },

  /**
   * Log membership renewed
   */
  async logMembershipRenewed(oldMembershipId, newMembershipId, userId, userName, renewalData, performedBy) {
    return this.createLog({
      actionType: 'membership_renewed',
      actionDescription: `Membresía renovada a ${renewalData.type} para ${userName}`,
      performedById: performedBy.id,
      performedByType: performedBy.type,
      performedByName: performedBy.name,
      entityType: 'membership',
      entityId: newMembershipId,
      entityName: `Membresía ${renewalData.type}`,
      relatedUserId: userId,
      relatedMembershipId: newMembershipId,
      changes: {
        old_membership_id: oldMembershipId,
        new_membership_id: newMembershipId,
        membership_type: renewalData.type,
        start_date: renewalData.startDate,
        end_date: renewalData.endDate,
        payment_method: renewalData.paymentMethod,
        payment_amount: renewalData.paymentAmount
      }
    })
  },

  /**
   * Log seller created
   */
  async logSellerCreated(sellerId, sellerName, sellerData, performedBy) {
    return this.createLog({
      actionType: 'seller_created',
      actionDescription: `Vendedor creado: ${sellerName} (${sellerData.role})`,
      performedById: performedBy.id,
      performedByType: performedBy.type,
      performedByName: performedBy.name,
      entityType: 'seller',
      entityId: sellerId,
      entityName: sellerName,
      changes: {
        email: sellerData.email,
        role: sellerData.role,
        phone: sellerData.phone
      }
    })
  },

  /**
   * Log coach created
   */
  async logCoachCreated(coachId, coachName, coachData, performedBy) {
    return this.createLog({
      actionType: 'coach_created',
      actionDescription: `Coach creado: ${coachName}`,
      performedById: performedBy.id,
      performedByType: performedBy.type,
      performedByName: performedBy.name,
      entityType: 'coach',
      entityId: coachId,
      entityName: coachName,
      changes: {
        email: coachData.email,
        specialization: coachData.specialization,
        phone: coachData.phone
      }
    })
  },

  /**
   * Log user created manually
   */
  async logUserCreated(userId, userName, userData, performedBy) {
    return this.createLog({
      actionType: 'user_created',
      actionDescription: `Usuario creado manualmente: ${userName}`,
      performedById: performedBy.id,
      performedByType: performedBy.type,
      performedByName: performedBy.name,
      entityType: 'user',
      entityId: userId,
      entityName: userName,
      relatedUserId: userId,
      changes: {
        email: userData.email,
        phone: userData.phone,
        membership_type: userData.membershipType
      }
    })
  }
}

export default logsService

