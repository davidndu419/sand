export type AdminRole =
  | "super_administrator"
  | "payment_reviewer"
  | "fulfilment_manager";

export type PaymentStatus = "pending" | "confirmed" | "declined";

export type FulfilmentStatus =
  | "awaiting_payment_confirmation"
  | "awaiting_allocation"
  | "funds_allocated"
  | "purchase_in_progress"
  | "awaiting_delivery"
  | "delivered"
  | "unable_to_fulfil"
  | "cancelled";

export type PaymentMethod = "gift_card" | "cryptocurrency";

export type AdminProfile = {
  id: string;
  role: AdminRole;
  display_name: string;
  active: boolean;
};

export type PublicCategory = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  minimum_amount_minor: number;
  suggested_amounts_minor: number[];
};

export type ReceiptView = {
  donation_date: string;
  soldier_tag: string | null;
  category_name: string;
  amount_minor: number;
  currency: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  fulfilment_status: FulfilmentStatus;
};
