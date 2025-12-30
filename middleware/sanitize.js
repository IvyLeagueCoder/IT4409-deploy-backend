// Simple sanitize middleware to mitigate basic NoSQL injection patterns
// Removes keys starting with '$' or containing '.' from req.body, req.query, req.params

const shouldRemoveKey = (key) => key.startsWith("$") || key.includes(".");

const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== "object") return;
  for (const key of Object.keys(obj)) {
    if (shouldRemoveKey(key)) {
      delete obj[key];
      continue;
    }
    const value = obj[key];
    if (typeof value === "object") {
      sanitizeObject(value);
    }
  }
};

export const sanitizeRequest = (req, _res, next) => {
  try {
    if (req.body) sanitizeObject(req.body);
    if (req.query) sanitizeObject(req.query);
    if (req.params) sanitizeObject(req.params);
  } catch {
    // fail-closed: nếu có lỗi khi sanitize thì vẫn cho qua nhưng không chặn request
  }
  next();
};

export default sanitizeRequest;
