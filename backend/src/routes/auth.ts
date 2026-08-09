import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../lib/auth.js";

export const authRouter = Router();

authRouter.get("/me", authenticate, async (req, res) => {
  const user = (req as any).user;
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  if (!dbUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const ownerEmail = process.env.ADMIN_OWNER_EMAIL;
  res.json({ ...dbUser, isOwner: !!ownerEmail && dbUser.email.toLowerCase() === ownerEmail.toLowerCase() });
});