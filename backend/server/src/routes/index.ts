import { Router, type IRouter } from "express";
import healthRouter from "./health";
import documentsRouter from "./documents";
import associationsRouter from "./associations";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(documentsRouter);
router.use(associationsRouter);
router.use(dashboardRouter);

export default router;
