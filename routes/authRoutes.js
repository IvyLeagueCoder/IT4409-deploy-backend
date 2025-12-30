import express from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/authController.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { verifyCaptcha } from '../middleware/captcha.js';

const router = express.Router();

const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 20,
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		message: 'Too many attempts, please try again later',
	},
});

router.post('/login', verifyCaptcha, authLimiter, authController.login);
router.post('/register', verifyCaptcha, authLimiter, authController.register);
router.post('/verify-email', authLimiter, authController.verifyEmailCode);
router.post('/forgot-password', authLimiter, authController.forgotPasswordRequest);
router.post('/reset-password', authLimiter, authController.resetPasswordWithCode);
router.post('/refresh-token', authLimiter, authController.refreshToken);
router.get('/profile', authenticateToken, authController.profile);
router.get('/admin-only', authenticateToken, authorizeRole('admin'), authController.adminOnly);

export default router;
