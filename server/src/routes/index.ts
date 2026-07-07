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

const router = Router();

// Global middleware
router.use(resolveTenant);
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

export default router;
