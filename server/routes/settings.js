import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { getUserSettings, updateUserSettings } from '../services/settingsService.js';

const router = express.Router();

// Require authentication for all settings endpoints
router.use(requireAuth);

/**
 * GET /api/settings
 * Returns user settings and allowed values
 */
router.get('/', (req, res) => {
  try {
    const settings = getUserSettings(req.user.id);
    res.json({
      success: true,
      settings
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * PATCH /api/settings
 * Updates user settings with validation (enum {20, 50, 100, 200})
 */
router.patch('/', (req, res) => {
  try {
    const updates = req.body || {};
    const settings = updateUserSettings(req.user.id, updates);
    res.json({
      success: true,
      settings
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({
      success: false,
      error: err.message
    });
  }
});

export default router;
