import { verifyToken } from '../utils/jwt.js';

// decode JWT và gắn thông tin user vào req
export const tokenDecoder = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No token provided',
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Token missing',
      });
    }

    const decoded = verifyToken(token);
    req.decodedToken = decoded;
    req.userId = decoded.id;
    req.role = decoded.role; 

    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: (error && error.message) || 'Invalid token',
    });
  }
};

export default tokenDecoder;
