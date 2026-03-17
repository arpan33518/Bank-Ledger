import {requireAuth} from "@clerk/express";

export const requireAuthMiddleware = requireAuth();

export default requireAuthMiddleware;
