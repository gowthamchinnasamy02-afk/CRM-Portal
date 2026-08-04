const AuditLog = require('../models/AuditLog');

const logAuditEvent = async ({ req, action, entity, entityId, details }) => {
    try {
        await AuditLog.create({
            userId: req && req.user ? req.user._id : null,
            userEmail: req && req.user ? req.user.email : 'System',
            action,
            entity,
            entityId: entityId || null,
            details: details || {},
            ipAddress: req ? req.ip || req.headers['x-forwarded-for'] || '127.0.0.1' : '127.0.0.1',
        });
    } catch (error) {
        console.error('[Audit Log Error]:', error.message);
    }
};

module.exports = { logAuditEvent };