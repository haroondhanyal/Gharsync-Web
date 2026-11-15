export type ApiResponse<T> = {
  data: T;
  meta?: { requestId?: string; timestamp: string };
};

export type ApiError = {
  statusCode: number;
  code: string;
  message: string;
  requestId?: string;
};

export type CurrencyCode = "PKR";
export type OrganizationRole = "OWNER" | "ADMIN" | "MANAGER" | "STAFF" | "TECHNICIAN";
export type BookingStatus =
  | "REQUESTED" | "UNDER_REVIEW" | "QUOTED" | "AWAITING_APPROVAL" | "APPROVED"
  | "SCHEDULED" | "ASSIGNED" | "TECHNICIAN_EN_ROUTE" | "IN_PROGRESS"
  | "COMPLETED" | "CANCELLED" | "DISPUTED";
