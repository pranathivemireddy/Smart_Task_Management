import AuditLog from '../models/AuditLog.js';

export const auditLogger = async (req, res, next) => {
  const originalJson = res.json;
  const originalSend = res.send;

  res.json = function(data) {
    res.locals.responseData = data;
    return originalJson.call(this, data);
  };

  res.send = function(data) {
    res.locals.responseData = data;
    return originalSend.call(this, data);
  };

  res.on('finish', async () => {
    try {
      if (req.user && shouldLog(req)) {
        const logEntry = {
          userId: req.user._id,
          action: getActionFromMethod(req.method),
          resource: getResourceFromPath(req.path),
          resourceId: req.params.id || null,
          details: getDetailsFromRequest(req),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent'),
        };

        await AuditLog.create(logEntry);
      }
    } catch (error) {
      console.error('Audit logging error:', error);
    }
  });

  next();
};

const shouldLog = (req) => {
  if (req.method === 'GET' && !req.path.includes('/admin/')) {
    return false;
  }

  if (req.path === '/api/health') {
    return false;
  }

  return true;
};

const getActionFromMethod = (method) => {
  switch (method) {
    case 'POST':
      return 'CREATE';
    case 'PUT':
    case 'PATCH':
      return 'UPDATE';
    case 'DELETE':
      return 'DELETE';
    default:
      return 'READ';
  }
};

const getResourceFromPath = (path) => {
  if (path.includes('/tasks')) return 'Task';
  if (path.includes('/users')) return 'User';
  if (path.includes('/auth')) return 'Auth';
  if (path.includes('/admin')) return 'Admin';
  return 'Unknown';
};

const getDetailsFromRequest = (req) => {
  const details = [];
  
  if (req.body && Object.keys(req.body).length > 0) {
    details.push(`Data: ${JSON.stringify(req.body)}`);
  }
  
  if (req.params && Object.keys(req.params).length > 0) {
    details.push(`Params: ${JSON.stringify(req.params)}`);
  }
  
  return details.join(', ');
};