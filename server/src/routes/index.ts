import { Router } from "express";
import { resolveTenant, authenticate } from "./helpers.js";
import authRoutes from "./auth.js";
import productRoutes from "./products.js";
import stockRoutes from "./stock.js";
import customerRoutes from "./customers.js";
import salesRoutes from "./sales.js";
import vendorRoutes from "./vendors.js";
import expenseRoutes from "./expenses.js";
import dashboardRoutes from "./dashboard.js";
import settingsRoutes from "./settings.js";
import activityLogRoutes from "./activity-logs.js";
import superRoutes from "./super.js";
import apiKeysRoutes from "./apiKeys.js";
import publicApiRoutes from "./publicApi.js";

const router = Router();

// Global middleware — skip tenant resolution for public API routes
// (those routes resolve tenant themselves via API key)
router.use((req, res, next) => {
  if (req.path.startsWith("/public/")) return next();
  return resolveTenant(req as any, res, next);
});
router.use(authenticate);

// Mount all route modules
router.use(authRoutes());
router.use(productRoutes());
router.use(stockRoutes());
router.use(customerRoutes());
router.use(salesRoutes());
router.use(vendorRoutes());
router.use(expenseRoutes());
router.use(dashboardRoutes());
router.use(settingsRoutes());
router.use(activityLogRoutes());
router.use(superRoutes());
router.use(apiKeysRoutes());
router.use(publicApiRoutes());

export default router;

