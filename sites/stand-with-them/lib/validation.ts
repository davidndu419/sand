import { z } from "zod";

export const soldierTagSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^SLD-[A-HJ-NP-Z2-9]{8}$/, "Enter a valid soldier tag."));

export const startDonationSchema = z
  .object({
    kind: z.enum(["soldier", "general"]),
    soldierTag: z.string().trim().optional(),
    categorySlug: z.string().regex(/^[a-z0-9-]{2,60}$/),
    amountMinor: z.number().int().min(100).max(100_000_000),
    currency: z.string().length(3).transform((value) => value.toUpperCase()),
    donorName: z.string().trim().min(2).max(100).optional().or(z.literal("")),
    donorEmail: z.string().email().max(254).optional().or(z.literal("")),
  })
  .superRefine((value, context) => {
    if (value.kind === "soldier" && !value.soldierTag) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["soldierTag"],
        message: "A soldier tag is required.",
      });
    }
  });

export const paymentSchema = z
  .object({
    accessCode: z.string().min(20).max(128),
    method: z.enum(["gift_card", "cryptocurrency"]),
    paymentOptionId: z.string().uuid(),
    giftCardCode: z.string().trim().min(6).max(500).optional(),
    transactionHash: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9:_-]{12,160}$/)
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.method === "gift_card" && !value.giftCardCode) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["giftCardCode"],
        message: "Enter the gift card code.",
      });
    }
    if (value.method === "cryptocurrency" && !value.transactionHash) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["transactionHash"],
        message: "Enter the transaction hash.",
      });
    }
  });

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export const registerSoldierSchema = z.object({
  privateIdentifier: z.string().trim().min(2).max(120),
  mobileNumber: z.string().trim().min(6).max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(2_000).optional().or(z.literal("")),
  categoryIds: z.array(z.string().uuid()).min(1).max(20).refine((ids) => new Set(ids).size === ids.length, "Select each category only once."),
});

export const reviewPaymentSchema = z.object({
  status: z.enum(["confirmed", "declined"]),
  reviewNotes: z.string().trim().max(2_000).optional().or(z.literal("")),
  declineReason: z.string().trim().max(500).optional().or(z.literal("")),
}).superRefine((value, context) => {
  if (value.status === "declined" && !value.declineReason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["declineReason"],
      message: "A decline reason is required.",
    });
  }
});

export const fulfilmentSchema = z.object({
  donationId: z.string().uuid(),
  action: z.enum(["allocate", "purchase", "status"]),
  amountMinor: z.number().int().positive().optional(),
  items: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    quantity: z.number().positive(),
    unit: z.string().trim().min(1).max(40),
  })).max(100).optional(),
  actualCostMinor: z.number().int().nonnegative().optional(),
  providerReference: z.string().trim().max(200).optional(),
  status: z.enum([
    "awaiting_allocation",
    "funds_allocated",
    "purchase_in_progress",
    "awaiting_delivery",
    "delivered",
    "unable_to_fulfil",
    "cancelled",
  ]).optional(),
  note: z.string().trim().min(2).max(2_000).optional(),
});
