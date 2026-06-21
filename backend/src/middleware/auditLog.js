const { pool } = require('../config/database');

const createAuditLog = async (actionBy, actionType, targetTable, targetId, description, ipAddress) => {
  try {
    await pool.query(
      'INSERT INTO audit_logs (action_by, action_type, target_table, target_id, description, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [actionBy, actionType, targetTable, targetId, description, ipAddress]
    );
  } catch (error) {
    console.error('Audit log error:', error.message);
  }
};

const auditMiddleware = (actionType, targetTable) => {
  return (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode < 400 && req.user) {
        const targetId = req.params.id || req.body.employee_id || '';
        const description = `${actionType} on ${targetTable} by ${req.user.employee_id}`;
        createAuditLog(
          req.user.employee_id,
          actionType,
          targetTable,
          targetId,
          description,
          req.ip
        );
      }
    });
    next();
  };
};

module.exports = { createAuditLog, auditMiddleware };
