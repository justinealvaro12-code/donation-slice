const express = require("express");
const { requirePermission } = require("../middleware/requirePermission");
const notificationRepository = require("../repositories/notificationRepository");

const router = express.Router();

router.get("/", requirePermission("donation.view"), async (req, res, next) => {
  try {
    const result = await notificationRepository.list(
      req.auth.organization_id,
      req.auth.user_id || req.auth.id,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.post(
  "/:key/read",
  requirePermission("donation.view"),
  async (req, res, next) => {
    try {
      await notificationRepository.markRead(
        req.auth.organization_id,
        req.auth.user_id || req.auth.id,
        req.params.key,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/read-all",
  requirePermission("donation.view"),
  async (req, res, next) => {
    try {
      await notificationRepository.markAllRead(
        req.auth.organization_id,
        req.auth.user_id || req.auth.id,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
