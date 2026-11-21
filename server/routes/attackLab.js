import express from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db/database.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { ATTACK_PRESETS, runSimulation, runBatchSimulation } from '../services/attackLabService.js';

const router = express.Router();

// Rate limiter for Attack Lab simulations (prevent model abuse)
const labLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, error: 'Simulation rate limit reached. Please wait a minute.' },
  standardHeaders: true,
  legacyHeaders: false
});

router.use(requireAuth);

/**
 * GET /api/attack-lab/presets
 * Returns available harmless presets for defensive testing
 */
router.get('/presets', (req, res) => {
  res.json({
    success: true,
    presets: ATTACK_PRESETS
  });
});

/**
 * POST /api/attack-lab/simulate
 * Runs a single side-by-side simulation (Naive vs MailMind Shielded)
 */
router.post('/simulate', labLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { presetId, customVector, naiveModel } = req.body;

    let params = null;
    if (presetId) {
      const found = ATTACK_PRESETS.find(p => p.id === presetId);
      if (!found) {
        return res.status(404).json({ success: false, error: 'Preset not found.' });
      }
      params = { ...found, naiveModel };
    } else if (customVector) {
      params = {
        name: customVector.name || 'Custom Adversarial Vector',
        subject: customVector.subject || 'Custom Test Subject',
        visibleBody: customVector.visibleBody || '',
        hiddenText: customVector.hiddenText || '',
        hideTechnique: customVector.hideTechnique || 'display:none',
        canary: customVector.canary || null,
        naiveModel
      };
    } else {
      return res.status(400).json({ success: false, error: 'presetId or customVector required.' });
    }

    const result = await runSimulation(params);

    // Save run in lab_runs table under user_id
    const runId = 'run_' + Date.now();
    db.prepare(`
      INSERT INTO lab_runs (id, user_id, scenario, results_json)
      VALUES (?, ?, ?, ?)
    `).run(
      runId,
      userId,
      params.name,
      JSON.stringify(result)
    );

    res.json({
      success: true,
      simulationId: runId,
      result
    });
  } catch (err) {
    console.error('[Attack Lab Simulation Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/attack-lab/run-batch
 * Runs 5 repeated trials to empirically evaluate hijack rate
 */
router.post('/run-batch', labLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { presetId, customVector, naiveModel, iterations = 5 } = req.body;

    let params = null;
    if (presetId) {
      const found = ATTACK_PRESETS.find(p => p.id === presetId);
      if (!found) {
        return res.status(404).json({ success: false, error: 'Preset not found.' });
      }
      params = { ...found, naiveModel };
    } else if (customVector) {
      params = {
        name: customVector.name || 'Custom Adversarial Vector',
        subject: customVector.subject || 'Custom Test Subject',
        visibleBody: customVector.visibleBody || '',
        hiddenText: customVector.hiddenText || '',
        hideTechnique: customVector.hideTechnique || 'display:none',
        canary: customVector.canary || null,
        naiveModel
      };
    } else {
      return res.status(400).json({ success: false, error: 'presetId or customVector required.' });
    }

    const count = Math.min(5, Math.max(2, parseInt(iterations, 10) || 5));
    const batchResult = await runBatchSimulation(params, count);

    // Save summary in lab_runs
    const runId = 'run_batch_' + Date.now();
    db.prepare(`
      INSERT INTO lab_runs (id, user_id, scenario, results_json)
      VALUES (?, ?, ?, ?)
    `).run(
      runId,
      userId,
      `${params.name} (Batch of ${count})`,
      JSON.stringify(batchResult)
    );

    res.json({
      success: true,
      simulationId: runId,
      batchResult
    });
  } catch (err) {
    console.error('[Attack Lab Batch Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/attack-lab/history
 * Returns user's recent simulation runs
 */
router.get('/history', (req, res) => {
  try {
    const userId = req.user.id;
    const runs = db.prepare(`
      SELECT * FROM lab_runs 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 10
    `).all(userId);

    const parsed = runs.map(r => ({
      ...r,
      results: JSON.parse(r.results_json)
    }));

    res.json({ success: true, history: parsed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
