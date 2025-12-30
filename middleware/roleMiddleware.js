import { verifyToken } from '../utils/jwt.js';

export const authorizeRoles = (allowedRoles = []) => {
  return (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2) {
      return res
        .status(401)
        .json({ success: false, message: 'Invalid token format' });
    }

    const [, token] = parts;
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: 'Token missing' });
    }

    try {
      const decoded = verifyToken(token);

      if (!decoded || !decoded.role) {
        return res
          .status(403)
          .json({ success: false, message: 'Access denied: role not found' });
      }

      if (!allowedRoles.includes(decoded.role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Your role does not have access',
        });
      }

      req.user = decoded;
      return next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        error: error?.message || error,
      });
    }
  };
};

export const isSelfOrAuthorizedRoles = (allowedRoles = []) => {
  return (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2) {
      return res
        .status(401)
        .json({ success: false, message: 'Invalid token format' });
    }

    const [, token] = parts;
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: 'Token missing' });
    }

    try {
      const decoded = verifyToken(token);

      const requestUserId =
        req.params?.id || req.body?.id || req.query?.id;

      if (!requestUserId) {
        return res.status(400).json({
          success: false,
          message: 'Missing id parameter in request',
        });
      }

      if (decoded.id === requestUserId || allowedRoles.includes(decoded.role)) {
        req.user = decoded;
        return next();
      }

      return res.status(403).json({
        success: false,
        message:
          'Access denied: Your role does not have access or this is not you',
      });
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        error: error?.message || error,
      });
    }
  };
};

export default { authorizeRoles, isSelfOrAuthorizedRoles };
