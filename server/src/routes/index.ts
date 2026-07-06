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

// Re-export warehouse routes from stock module inline
export default router;
