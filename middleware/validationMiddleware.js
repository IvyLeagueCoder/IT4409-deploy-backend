// Middleware validate body đơn giản, cảm hứng từ ValidationMiddleware (class-validator)
// validateFn: (body) => ({ valid: boolean, errors?: any })

export const validationMiddleware = (validateFn) => {
  return (req, res, next) => {
    try {
      const result = validateFn(req.body || {});

      if (!result || result.valid === false) {
        const details = result && result.errors ? result.errors : [];
        return res.status(400).json({
          success: false,
          message: 'Invalid data',
          errors: details,
        });
      }

      return next();
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid data',
        error: error && error.message ? error.message : error,
      });
    }
  };
};

export default validationMiddleware;
